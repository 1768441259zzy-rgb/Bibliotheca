'use client';

import { parseEbookFile } from '@/lib/reading/parseEbook';
import type { ParsedEbook } from '@/lib/reading/parseEbook';
import {
  readAnnotations,
  writeAnnotations,
  type ReadingAnnotation,
} from '@/lib/reading/annotations';
import {
  type ReadingSessionMeta,
  listSessions,
  loadBookPayload,
  saveBookPayload,
  upsertSessionMeta,
  removeSession as removeLocalSession,
  patchPrefs,
  READING_CLOUD_MAX_BYTES,
} from '@/lib/reading/readingCloudShared';

export { READING_CLOUD_MAX_BYTES };

function mergeSessions(
  local: ReadingSessionMeta[],
  cloud: ReadingSessionMeta[]
): ReadingSessionMeta[] {
  const map = new Map<string, ReadingSessionMeta>();
  for (const s of local) map.set(s.id, s);
  for (const s of cloud) {
    const prev = map.get(s.id);
    if (!prev) {
      map.set(s.id, { ...s, cloudSyncedAt: s.updatedAt });
      continue;
    }
    const newer =
      new Date(s.updatedAt).getTime() >= new Date(prev.updatedAt).getTime()
        ? s
        : prev;
    map.set(s.id, {
      ...prev,
      ...newer,
      storagePath: s.storagePath ?? prev.storagePath,
      storageKind: s.storageKind ?? prev.storageKind,
      fileName: s.fileName ?? prev.fileName,
      fileSize: s.fileSize ?? prev.fileSize,
      mimeType: s.mimeType ?? prev.mimeType,
      cloudSyncedAt: s.updatedAt,
    });
  }
  return [...map.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

function writeMergedLocal(list: ReadingSessionMeta[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    'bibliotheca-reading-sessions',
    JSON.stringify(list.slice(0, 40))
  );
}

/** 从云端拉会话列表，与本机合并 */
export async function pullReadingSessionsFromCloud(): Promise<ReadingSessionMeta[]> {
  const local = listSessions();
  try {
    const res = await fetch('/api/reading/sessions');
    const data = (await res.json()) as {
      sessions?: ReadingSessionMeta[];
      error?: string;
    };
    if (!res.ok) {
      console.warn('pullReadingSessionsFromCloud:', data.error);
      return local;
    }
    const merged = mergeSessions(local, data.sessions ?? []);
    writeMergedLocal(merged);
    return merged;
  } catch (err) {
    console.warn('pullReadingSessionsFromCloud failed:', err);
    return local;
  }
}

/** 进度推到云端（失败不打断阅读） */
export async function pushReadingProgress(
  meta: Pick<
    ReadingSessionMeta,
    'id' | 'chapterIndex' | 'fontScale' | 'scrollTop' | 'updatedAt'
  >
): Promise<void> {
  try {
    await fetch('/api/reading/sessions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: meta.id,
        chapterIndex: meta.chapterIndex,
        fontScale: meta.fontScale,
        scrollTop: meta.scrollTop,
        updatedAt: meta.updatedAt,
      }),
    });
  } catch (err) {
    console.warn('pushReadingProgress failed:', err);
  }
}

async function signedUploadBlob(opts: {
  id: string;
  title: string;
  format: 'txt' | 'epub' | 'pdf';
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKind: 'original' | 'payload';
  blob: Blob;
  chapterIndex: number;
  fontScale: number;
  scrollTop: number;
  pageCount?: number;
}): Promise<ReadingSessionMeta | null> {
  if (opts.fileSize > READING_CLOUD_MAX_BYTES) {
    throw new Error(
      `文件超过云端上限（${Math.floor(READING_CLOUD_MAX_BYTES / (1024 * 1024))}MB），请压缩后再同步`
    );
  }

  const prepare = await fetch('/api/reading/sessions/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: opts.id,
      title: opts.title,
      format: opts.format,
      fileName: opts.fileName,
      fileSize: opts.fileSize,
      mimeType: opts.mimeType,
      storageKind: opts.storageKind,
      chapterIndex: opts.chapterIndex,
      fontScale: opts.fontScale,
      scrollTop: opts.scrollTop,
      pageCount: opts.pageCount,
    }),
  });
  const prepared = (await prepare.json()) as {
    session?: ReadingSessionMeta;
    upload?: { signedUrl: string; token: string; path: string };
    storagePath?: string;
    error?: string;
  };
  if (!prepare.ok || !prepared.upload?.signedUrl || !prepared.session) {
    throw new Error(prepared.error || '准备云端上传失败');
  }

  const put = await fetch(prepared.upload.signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': opts.mimeType || 'application/octet-stream',
    },
    body: opts.blob,
  });
  if (!put.ok) {
    throw new Error('上传到云端存储失败');
  }

  const session: ReadingSessionMeta = {
    ...prepared.session,
    storagePath: prepared.storagePath ?? prepared.session.storagePath,
    storageKind: opts.storageKind,
    fileName: opts.fileName,
    fileSize: opts.fileSize,
    mimeType: opts.mimeType,
    cloudSyncedAt: new Date().toISOString(),
  };
  upsertSessionMeta(session);
  return session;
}

/** 新打开的书：把原始文件推上云 */
export async function syncOpenedBookToCloud(
  meta: ReadingSessionMeta,
  file: File
): Promise<ReadingSessionMeta | null> {
  try {
    return await signedUploadBlob({
      id: meta.id,
      title: meta.title,
      format: meta.format,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      storageKind: 'original',
      blob: file,
      chapterIndex: meta.chapterIndex,
      fontScale: meta.fontScale,
      scrollTop: meta.scrollTop,
      pageCount: meta.pageCount,
    });
  } catch (err) {
    console.warn('syncOpenedBookToCloud failed:', err);
    return null;
  }
}

/** 本机已有解析结果、无原文件：上传 payload JSON 以便其他设备恢复 */
export async function syncLocalPayloadToCloud(
  meta: ReadingSessionMeta
): Promise<ReadingSessionMeta | null> {
  try {
    const book = await loadBookPayload(meta.id);
    if (!book) return null;
    const payload = {
      id: meta.id,
      title: book.title,
      format: book.format,
      chapters: book.chapters,
      pageCount: book.pageCount,
      pdfBytes: book.pdfData ? Array.from(book.pdfData) : undefined,
    };
    const json = JSON.stringify(payload);
    const blob = new Blob([json], { type: 'application/json' });
    return await signedUploadBlob({
      id: meta.id,
      title: meta.title,
      format: meta.format,
      fileName: `${meta.title || 'book'}.bibliotheca.json`,
      fileSize: blob.size,
      mimeType: 'application/json',
      storageKind: 'payload',
      blob,
      chapterIndex: meta.chapterIndex,
      fontScale: meta.fontScale,
      scrollTop: meta.scrollTop,
      pageCount: meta.pageCount,
    });
  } catch (err) {
    console.warn('syncLocalPayloadToCloud failed:', err);
    return null;
  }
}

/** 确保本机有书：没有则从云端下载并解析/还原 */
export async function ensureBookAvailable(
  sessionId: string
): Promise<ParsedEbook | null> {
  const local = await loadBookPayload(sessionId);
  if (local) return local;

  const res = await fetch(
    `/api/reading/sessions/${encodeURIComponent(sessionId)}/file`
  );
  const data = (await res.json()) as {
    url?: string;
    storageKind?: 'original' | 'payload';
    fileName?: string;
    mimeType?: string;
    format?: 'txt' | 'epub' | 'pdf';
    title?: string;
    error?: string;
  };
  if (!res.ok || !data.url) {
    throw new Error(data.error || '云端没有这本书');
  }

  const fileRes = await fetch(data.url);
  if (!fileRes.ok) throw new Error('下载电子书失败');
  const buf = await fileRes.arrayBuffer();

  if (data.storageKind === 'payload') {
    const text = new TextDecoder().decode(buf);
    const row = JSON.parse(text) as {
      title: string;
      format: 'txt' | 'epub' | 'pdf';
      chapters: ParsedEbook['chapters'];
      pageCount?: number;
      pdfBytes?: number[];
    };
    const book: ParsedEbook = {
      title: row.title,
      format: row.format,
      chapters: row.chapters,
      pageCount: row.pageCount,
      pdfData: row.pdfBytes ? Uint8Array.from(row.pdfBytes) : undefined,
    };
    await saveBookPayload(sessionId, book);
    return book;
  }

  const name = data.fileName || `${data.title || 'book'}.${data.format || 'epub'}`;
  const file = new File([buf], name, {
    type: data.mimeType || 'application/octet-stream',
  });
  const parsed = await parseEbookFile(file);
  await saveBookPayload(sessionId, parsed);
  return parsed;
}

export async function deleteReadingSessionEverywhere(
  id: string
): Promise<ReadingSessionMeta[]> {
  const list = await removeLocalSession(id);
  try {
    await fetch(`/api/reading/sessions?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('cloud delete session failed:', err);
  }
  return list;
}

function mergeAnnotations(
  local: ReadingAnnotation[],
  cloud: ReadingAnnotation[]
): ReadingAnnotation[] {
  const map = new Map<string, ReadingAnnotation>();
  for (const a of local) map.set(a.id, a);
  for (const a of cloud) {
    const prev = map.get(a.id);
    if (!prev) {
      map.set(a.id, { ...a, synced: true });
      continue;
    }
    const newerCloud =
      new Date(a.createdAt).getTime() >= new Date(prev.createdAt).getTime();
    map.set(a.id, {
      ...(newerCloud ? a : prev),
      synced: true,
    });
  }
  return [...map.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function pullAnnotationsFromCloud(): Promise<ReadingAnnotation[]> {
  const local = readAnnotations();
  try {
    const res = await fetch('/api/reading/annotations');
    const data = (await res.json()) as {
      annotations?: ReadingAnnotation[];
      error?: string;
    };
    if (!res.ok) return local;
    const merged = mergeAnnotations(local, data.annotations ?? []);
    writeAnnotations(merged);
    return merged;
  } catch {
    return local;
  }
}

export async function pushAnnotationToCloud(
  annotation: ReadingAnnotation
): Promise<void> {
  try {
    await fetch('/api/reading/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annotation }),
    });
  } catch (err) {
    console.warn('pushAnnotationToCloud failed:', err);
  }
}

export async function pushAllAnnotationsToCloud(): Promise<void> {
  const items = readAnnotations();
  if (items.length === 0) return;
  try {
    await fetch('/api/reading/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annotations: items }),
    });
  } catch (err) {
    console.warn('pushAllAnnotationsToCloud failed:', err);
  }
}

export async function deleteAnnotationEverywhere(id: string): Promise<void> {
  try {
    await fetch(`/api/reading/annotations?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('deleteAnnotationEverywhere failed:', err);
  }
}

/** 启动时：拉云端会话；本机有书无云文件的，后台迁移 payload */
export async function bootstrapReadingCloud(): Promise<ReadingSessionMeta[]> {
  const merged = await pullReadingSessionsFromCloud();
  await pullAnnotationsFromCloud();
  await pushAllAnnotationsToCloud();

  // 后台把本机独有会话迁到云（不阻塞 UI）
  void (async () => {
    for (const s of merged) {
      if (s.storagePath) continue;
      const book = await loadBookPayload(s.id);
      if (!book) continue;
      await syncLocalPayloadToCloud(s);
    }
  })();

  return merged;
}

/** 兼容：云端常量从 shared 再导出，避免 client 直接引 admin */
export function getCloudMaxBytes() {
  return READING_CLOUD_MAX_BYTES;
}

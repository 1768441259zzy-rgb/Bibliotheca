/**
 * 阅读记录：IndexedDB 存书卷正文，localStorage 存偏好与会话元数据索引
 */

import type { EbookFormat, ParsedEbook } from '@/lib/reading/parseEbook';
import type { ReadingScene } from '@/lib/reading/scenes';
import type { AmbientSoundId } from '@/lib/reading/scenes';

export type BookSize = 'standard' | 'wide' | 'full';

export interface ReadingSessionMeta {
  id: string;
  title: string;
  format: EbookFormat;
  chapterIndex: number;
  fontScale: number;
  scrollTop: number;
  updatedAt: string;
  pageCount?: number;
  /** 云端：原始文件名 */
  fileName?: string;
  /** 云端 Storage 路径 */
  storagePath?: string;
  /** original=上传的电子书；payload=本机解析结果迁移包 */
  storageKind?: 'original' | 'payload';
  fileSize?: number;
  mimeType?: string;
  /** 最近一次成功同步到云端的时间 */
  cloudSyncedAt?: string;
}

export interface SavedNeteaseItem {
  /** type-id 作为唯一键 */
  key: string;
  type: 0 | 1 | 2;
  id: string;
  label: '歌单' | '专辑' | '单曲';
  url: string;
  /** 用户可改的短名，默认「歌单 · id」 */
  title: string;
  savedAt: string;
}

export interface SavedLocalMusicMeta {
  /** local-{id} */
  key: string;
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  size: number;
  savedAt: string;
}

export type MusicPlayMode = 'order' | 'random';
/** @deprecated 用 MusicPlayMode */
export type NeteasePlayMode = MusicPlayMode;

export type PlaylistTrack =
  | {
      kind: 'netease';
      key: string;
      title: string;
      savedAt: string;
      item: SavedNeteaseItem;
    }
  | {
      kind: 'local';
      key: string;
      title: string;
      savedAt: string;
      item: SavedLocalMusicMeta;
    };

export interface ReadingPrefs {
  scene: ReadingScene;
  bookSize: BookSize;
  lastSessionId: string | null;
  ambientVol: Record<AmbientSoundId, number>;
  /** 阅读区羊皮纸玻璃不透明度 0.15–0.85 */
  glassOpacity: number;
  /** 当前正在播放的网易云链接 */
  neteaseUrl: string;
  /** 外链播放器样式高度：66 紧凑 · 430 带列表 */
  neteasePlayerHeight: number;
  /** 已导入的网易云收藏 */
  neteaseLibrary: SavedNeteaseItem[];
  /** 本地音乐元数据（音频本体在 IndexedDB） */
  localMusicLibrary: SavedLocalMusicMeta[];
  /** 当前播放项 key（网易云或本地） */
  currentMusicKey: string;
  /** 播放栏收藏切换：顺序 / 随机 */
  musicPlayMode: MusicPlayMode;
  /** @deprecated 兼容旧字段，读时会迁移到 musicPlayMode */
  neteasePlayMode?: MusicPlayMode;
}

const PREFS_KEY = 'bibliotheca-reading-prefs';
const META_KEY = 'bibliotheca-reading-sessions';
const DB_NAME = 'bibliotheca-reading-db';
const DB_VERSION = 2;
const BOOK_STORE = 'books';
const LOCAL_MUSIC_STORE = 'localMusic';

export const LOCAL_MUSIC_MAX_COUNT = 24;
/** 单首上限：大体积 wav / flac 常见 40–120MB，IndexedDB 可存 Blob */
export const LOCAL_MUSIC_MAX_BYTES = 200 * 1024 * 1024;

const DEFAULT_PREFS: ReadingPrefs = {
  scene: 'sunroom',
  bookSize: 'wide',
  lastSessionId: null,
  ambientVol: {
    'jiangnan-rain': 0.4,
    'forest-birds': 0.35,
    'banana-rain': 0.4,
    'candle-moon': 0.35,
  },
  glassOpacity: 0.4,
  neteaseUrl: '',
  neteasePlayerHeight: 66,
  neteaseLibrary: [],
  localMusicLibrary: [],
  currentMusicKey: '',
  musicPlayMode: 'order',
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BOOK_STORE)) {
        db.createObjectStore(BOOK_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(LOCAL_MUSIC_STORE)) {
        db.createObjectStore(LOCAL_MUSIC_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

interface StoredLocalMusic {
  id: string;
  blob: Blob;
  mimeType: string;
  fileName: string;
}

export function readPrefs(): ReadingPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<ReadingPrefs> & {
      neteasePlayMode?: MusicPlayMode;
    };
    const mode =
      parsed.musicPlayMode === 'random' || parsed.musicPlayMode === 'order'
        ? parsed.musicPlayMode
        : parsed.neteasePlayMode === 'random' || parsed.neteasePlayMode === 'order'
          ? parsed.neteasePlayMode
          : DEFAULT_PREFS.musicPlayMode;
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      ambientVol: { ...DEFAULT_PREFS.ambientVol, ...parsed.ambientVol },
      glassOpacity:
        typeof parsed.glassOpacity === 'number'
          ? Math.min(0.85, Math.max(0.12, parsed.glassOpacity))
          : DEFAULT_PREFS.glassOpacity,
      neteaseUrl:
        typeof parsed.neteaseUrl === 'string' ? parsed.neteaseUrl : '',
      neteasePlayerHeight:
        parsed.neteasePlayerHeight === 430 || parsed.neteasePlayerHeight === 66
          ? parsed.neteasePlayerHeight
          : DEFAULT_PREFS.neteasePlayerHeight,
      neteaseLibrary: Array.isArray(parsed.neteaseLibrary)
        ? parsed.neteaseLibrary.filter(
            (item) =>
              item &&
              typeof item.key === 'string' &&
              typeof item.id === 'string' &&
              typeof item.url === 'string'
          )
        : [],
      localMusicLibrary: Array.isArray(parsed.localMusicLibrary)
        ? parsed.localMusicLibrary.filter(
            (item) =>
              item &&
              typeof item.key === 'string' &&
              typeof item.id === 'string' &&
              typeof item.fileName === 'string'
          )
        : [],
      currentMusicKey:
        typeof parsed.currentMusicKey === 'string'
          ? parsed.currentMusicKey
          : '',
      musicPlayMode: mode,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writePrefs(prefs: ReadingPrefs): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function patchPrefs(patch: Partial<ReadingPrefs>): ReadingPrefs {
  const next = { ...readPrefs(), ...patch };
  if (patch.ambientVol) {
    next.ambientVol = { ...readPrefs().ambientVol, ...patch.ambientVol };
  }
  writePrefs(next);
  return next;
}

export function upsertNeteaseLibraryItem(
  item: SavedNeteaseItem
): SavedNeteaseItem[] {
  const prefs = readPrefs();
  const list = prefs.neteaseLibrary.filter((x) => x.key !== item.key);
  list.unshift(item);
  const trimmed = list.slice(0, 24);
  writePrefs({
    ...prefs,
    neteaseLibrary: trimmed,
    neteaseUrl: item.url,
    currentMusicKey: item.key,
  });
  return trimmed;
}

export function removeNeteaseLibraryItem(key: string): SavedNeteaseItem[] {
  const prefs = readPrefs();
  const trimmed = prefs.neteaseLibrary.filter((x) => x.key !== key);
  const patch: Partial<ReadingPrefs> = { neteaseLibrary: trimmed };
  if (prefs.currentMusicKey === key) {
    const nextNetease = trimmed[0];
    const nextLocal = prefs.localMusicLibrary[0];
    if (nextNetease) {
      patch.currentMusicKey = nextNetease.key;
      patch.neteaseUrl = nextNetease.url;
    } else if (nextLocal) {
      patch.currentMusicKey = nextLocal.key;
      patch.neteaseUrl = '';
    } else {
      patch.currentMusicKey = '';
      patch.neteaseUrl = '';
    }
  }
  writePrefs({ ...prefs, ...patch });
  return trimmed;
}

/** 改名：保持列表顺序不变 */
export function renameNeteaseLibraryItem(
  key: string,
  title: string
): SavedNeteaseItem[] {
  const prefs = readPrefs();
  const list = prefs.neteaseLibrary.map((x) =>
    x.key === key ? { ...x, title } : x
  );
  writePrefs({ ...prefs, neteaseLibrary: list });
  return list;
}

export function buildMusicPlaylist(
  netease: SavedNeteaseItem[],
  local: SavedLocalMusicMeta[]
): PlaylistTrack[] {
  const tracks: PlaylistTrack[] = [
    ...netease.map((item) => ({
      kind: 'netease' as const,
      key: item.key,
      title: item.title,
      savedAt: item.savedAt,
      item,
    })),
    ...local.map((item) => ({
      kind: 'local' as const,
      key: item.key,
      title: item.title,
      savedAt: item.savedAt,
      item,
    })),
  ];
  return tracks.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim() || name;
}

export async function importLocalMusicFile(
  file: File
): Promise<SavedLocalMusicMeta> {
  if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(file.name)) {
    throw new Error('请选择音频文件（mp3 / wav / m4a 等）');
  }
  if (file.size > LOCAL_MUSIC_MAX_BYTES) {
    throw new Error(
      `文件过大（${(file.size / (1024 * 1024)).toFixed(0)}MB），单首上限 200MB`
    );
  }
  const prefs = readPrefs();
  if (prefs.localMusicLibrary.length >= LOCAL_MUSIC_MAX_COUNT) {
    throw new Error(`本地音乐最多 ${LOCAL_MUSIC_MAX_COUNT} 首，请先删几首`);
  }

  const id = `lm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const meta: SavedLocalMusicMeta = {
    key: `local-${id}`,
    id,
    title: titleFromFileName(file.name),
    fileName: file.name,
    mimeType: file.type || 'audio/mpeg',
    size: file.size,
    savedAt: new Date().toISOString(),
  };

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(LOCAL_MUSIC_STORE, 'readwrite');
      tx.objectStore(LOCAL_MUSIC_STORE).put({
        id,
        blob: file,
        mimeType: meta.mimeType,
        fileName: file.name,
      } satisfies StoredLocalMusic);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('存储被中断'));
    });
    db.close();
  } catch (err) {
    const name =
      err && typeof err === 'object' && 'name' in err
        ? String((err as { name: string }).name)
        : '';
    if (name === 'QuotaExceededError' || /quota/i.test(String(err))) {
      throw new Error('浏览器存储空间不足，请删几首本地曲或清站点数据后再试');
    }
    throw new Error('写入本地存储失败，请换小一点的文件或稍后重试');
  }

  const list = [meta, ...prefs.localMusicLibrary];
  writePrefs({
    ...prefs,
    localMusicLibrary: list,
    currentMusicKey: meta.key,
    neteaseUrl: '',
  });
  return meta;
}

export async function loadLocalMusicBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  const row = await new Promise<StoredLocalMusic | undefined>((resolve, reject) => {
    const tx = db.transaction(LOCAL_MUSIC_STORE, 'readonly');
    const req = tx.objectStore(LOCAL_MUSIC_STORE).get(id);
    req.onsuccess = () => resolve(req.result as StoredLocalMusic | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return row?.blob ?? null;
}

export async function removeLocalMusicItem(
  key: string
): Promise<SavedLocalMusicMeta[]> {
  const prefs = readPrefs();
  const target = prefs.localMusicLibrary.find((x) => x.key === key);
  const trimmed = prefs.localMusicLibrary.filter((x) => x.key !== key);

  if (target) {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(LOCAL_MUSIC_STORE, 'readwrite');
      tx.objectStore(LOCAL_MUSIC_STORE).delete(target.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  const patch: Partial<ReadingPrefs> = { localMusicLibrary: trimmed };
  if (prefs.currentMusicKey === key) {
    const nextLocal = trimmed[0];
    const nextNetease = prefs.neteaseLibrary[0];
    patch.currentMusicKey = nextLocal?.key ?? nextNetease?.key ?? '';
    patch.neteaseUrl = nextLocal ? '' : nextNetease?.url ?? '';
  }
  writePrefs({ ...prefs, ...patch });
  return trimmed;
}

export function renameLocalMusicItem(
  key: string,
  title: string
): SavedLocalMusicMeta[] {
  const prefs = readPrefs();
  const list = prefs.localMusicLibrary.map((x) =>
    x.key === key ? { ...x, title } : x
  );
  writePrefs({ ...prefs, localMusicLibrary: list });
  return list;
}

export function listSessions(): ReadingSessionMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReadingSessionMeta[];
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      : [];
  } catch {
    return [];
  }
}

function writeSessionList(list: ReadingSessionMeta[]): void {
  localStorage.setItem(META_KEY, JSON.stringify(list));
}

export function upsertSessionMeta(meta: ReadingSessionMeta): ReadingSessionMeta[] {
  const list = listSessions().filter((s) => s.id !== meta.id);
  list.unshift(meta);
  writeSessionList(list.slice(0, 30));
  return list;
}

export function removeSessionMeta(id: string): ReadingSessionMeta[] {
  const list = listSessions().filter((s) => s.id !== id);
  writeSessionList(list);
  return list;
}

interface StoredBook {
  id: string;
  title: string;
  format: EbookFormat;
  chapters: {
    title: string;
    html: string;
    text: string;
    path?: string;
  }[];
  pageCount?: number;
  /** PDF 原始字节（可序列化） */
  pdfBytes?: number[];
}

export async function saveBookPayload(
  id: string,
  book: ParsedEbook
): Promise<void> {
  const db = await openDb();
  const payload: StoredBook = {
    id,
    title: book.title,
    format: book.format,
    chapters: book.chapters,
    pageCount: book.pageCount,
    pdfBytes: book.pdfData ? Array.from(book.pdfData) : undefined,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BOOK_STORE, 'readwrite');
    tx.objectStore(BOOK_STORE).put(payload);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadBookPayload(id: string): Promise<ParsedEbook | null> {
  const db = await openDb();
  const row = await new Promise<StoredBook | undefined>((resolve, reject) => {
    const tx = db.transaction(BOOK_STORE, 'readonly');
    const req = tx.objectStore(BOOK_STORE).get(id);
    req.onsuccess = () => resolve(req.result as StoredBook | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (!row) return null;
  return {
    title: row.title,
    format: row.format,
    chapters: row.chapters,
    pageCount: row.pageCount,
    pdfData: row.pdfBytes ? Uint8Array.from(row.pdfBytes) : undefined,
  };
}

export async function deleteBookPayload(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BOOK_STORE, 'readwrite');
    tx.objectStore(BOOK_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function makeSessionId(title: string, format: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return `rs-${format}-${slug}-${Date.now().toString(36)}`;
}

/** 同名同格式则复用已有 session id，避免重复记录 */
export function findSessionByTitle(
  title: string,
  format: string
): ReadingSessionMeta | undefined {
  return listSessions().find(
    (s) => s.title === title && s.format === format
  );
}

export async function persistOpenedBook(
  book: ParsedEbook,
  state: {
    chapterIndex: number;
    fontScale: number;
    scrollTop: number;
  }
): Promise<ReadingSessionMeta> {
  const existing = findSessionByTitle(book.title, book.format);
  const id = existing?.id ?? makeSessionId(book.title, book.format);
  const meta: ReadingSessionMeta = {
    id,
    title: book.title,
    format: book.format,
    chapterIndex: state.chapterIndex,
    fontScale: state.fontScale,
    scrollTop: state.scrollTop,
    updatedAt: new Date().toISOString(),
    pageCount: book.pageCount ?? book.chapters.length,
  };
  await saveBookPayload(id, book);
  upsertSessionMeta(meta);
  patchPrefs({ lastSessionId: id });
  return meta;
}

export async function updateSessionProgress(
  id: string,
  patch: Partial<
    Pick<
      ReadingSessionMeta,
      'chapterIndex' | 'fontScale' | 'scrollTop' | 'updatedAt'
    >
  >
): Promise<void> {
  const list = listSessions();
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return;
  list[idx] = {
    ...list[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeSessionList(
    list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  );
}

export async function removeSession(id: string): Promise<ReadingSessionMeta[]> {
  await deleteBookPayload(id);
  const list = removeSessionMeta(id);
  const prefs = readPrefs();
  if (prefs.lastSessionId === id) {
    patchPrefs({ lastSessionId: list[0]?.id ?? null });
  }
  return list;
}

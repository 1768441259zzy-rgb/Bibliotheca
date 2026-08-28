import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { ReadingSessionMeta } from '@/lib/reading/readingStore';
import type { ReadingAnnotation } from '@/lib/reading/annotations';

export const READING_BOOKS_BUCKET = 'reading-books';
/** Supabase Free 单文件上限约 50MB — 与 readingCloudShared 保持一致 */
export const READING_CLOUD_MAX_BYTES = 50 * 1024 * 1024;

export type StorageKind = 'original' | 'payload';

export interface CloudReadingSession {
  id: string;
  title: string;
  format: 'txt' | 'epub' | 'pdf';
  fileName?: string;
  storagePath?: string;
  storageKind: StorageKind;
  fileSize?: number;
  mimeType?: string;
  chapterIndex: number;
  fontScale: number;
  scrollTop: number;
  pageCount?: number;
  updatedAt: string;
  createdAt?: string;
}

interface SessionRow {
  id: string;
  title: string;
  format: string;
  file_name: string | null;
  storage_path: string | null;
  storage_kind: string;
  file_size: number | null;
  mime_type: string | null;
  chapter_index: number;
  font_scale: number;
  scroll_top: number;
  page_count: number | null;
  updated_at: string;
  created_at: string;
}

interface AnnotationRow {
  id: string;
  book_title: string;
  chapter_index: number;
  chapter_title: string;
  quote: string;
  note: string;
  color: string;
  created_at: string;
  updated_at: string;
}

function rowToSession(row: SessionRow): CloudReadingSession {
  return {
    id: row.id,
    title: row.title,
    format: row.format as 'txt' | 'epub' | 'pdf',
    storageKind: (row.storage_kind as StorageKind) || 'original',
    chapterIndex: row.chapter_index ?? 0,
    fontScale: row.font_scale ?? 1,
    scrollTop: row.scroll_top ?? 0,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    ...(row.file_name ? { fileName: row.file_name } : {}),
    ...(row.storage_path ? { storagePath: row.storage_path } : {}),
    ...(typeof row.file_size === 'number' ? { fileSize: row.file_size } : {}),
    ...(row.mime_type ? { mimeType: row.mime_type } : {}),
    ...(typeof row.page_count === 'number' ? { pageCount: row.page_count } : {}),
  };
}

export function cloudSessionToMeta(s: CloudReadingSession): ReadingSessionMeta {
  return {
    id: s.id,
    title: s.title,
    format: s.format,
    chapterIndex: s.chapterIndex,
    fontScale: s.fontScale,
    scrollTop: s.scrollTop,
    updatedAt: s.updatedAt,
    pageCount: s.pageCount,
    fileName: s.fileName,
    storagePath: s.storagePath,
    storageKind: s.storageKind,
    fileSize: s.fileSize,
    mimeType: s.mimeType,
    cloudSyncedAt: s.updatedAt,
  };
}

export async function listCloudSessions(): Promise<CloudReadingSession[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('reading_sessions')
    .select(
      'id, title, format, file_name, storage_path, storage_kind, file_size, mime_type, chapter_index, font_scale, scroll_top, page_count, updated_at, created_at'
    )
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('listCloudSessions failed:', error);
    throw new Error(error.message);
  }

  return ((data as SessionRow[] | null) ?? []).map(rowToSession);
}

export async function upsertCloudSession(input: {
  id: string;
  title: string;
  format: 'txt' | 'epub' | 'pdf';
  fileName?: string;
  storagePath?: string;
  storageKind?: StorageKind;
  fileSize?: number;
  mimeType?: string;
  chapterIndex?: number;
  fontScale?: number;
  scrollTop?: number;
  pageCount?: number;
  updatedAt?: string;
}): Promise<CloudReadingSession> {
  const supabase = getSupabaseAdmin();
  const now = input.updatedAt ?? new Date().toISOString();
  const row = {
    id: input.id,
    title: input.title,
    format: input.format,
    file_name: input.fileName ?? null,
    storage_path: input.storagePath ?? null,
    storage_kind: input.storageKind ?? 'original',
    file_size: input.fileSize ?? null,
    mime_type: input.mimeType ?? null,
    chapter_index: input.chapterIndex ?? 0,
    font_scale: input.fontScale ?? 1,
    scroll_top: input.scrollTop ?? 0,
    page_count: input.pageCount ?? null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('reading_sessions')
    .upsert(row, { onConflict: 'id' })
    .select(
      'id, title, format, file_name, storage_path, storage_kind, file_size, mime_type, chapter_index, font_scale, scroll_top, page_count, updated_at, created_at'
    )
    .single();

  if (error) {
    console.error('upsertCloudSession failed:', error);
    throw new Error(error.message);
  }

  return rowToSession(data as SessionRow);
}

export async function patchCloudSessionProgress(
  id: string,
  patch: {
    chapterIndex?: number;
    fontScale?: number;
    scrollTop?: number;
    updatedAt?: string;
  }
): Promise<CloudReadingSession | null> {
  const supabase = getSupabaseAdmin();
  const body: Record<string, unknown> = {
    updated_at: patch.updatedAt ?? new Date().toISOString(),
  };
  if (patch.chapterIndex !== undefined) body.chapter_index = patch.chapterIndex;
  if (patch.fontScale !== undefined) body.font_scale = patch.fontScale;
  if (patch.scrollTop !== undefined) body.scroll_top = patch.scrollTop;

  const { data, error } = await supabase
    .from('reading_sessions')
    .update(body)
    .eq('id', id)
    .select(
      'id, title, format, file_name, storage_path, storage_kind, file_size, mime_type, chapter_index, font_scale, scroll_top, page_count, updated_at, created_at'
    )
    .maybeSingle();

  if (error) {
    console.error('patchCloudSessionProgress failed:', error);
    throw new Error(error.message);
  }

  return data ? rowToSession(data as SessionRow) : null;
}

export async function deleteCloudSession(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from('reading_sessions')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();

  const path = (existing as { storage_path?: string } | null)?.storage_path;
  if (path) {
    const { error: rmError } = await supabase.storage
      .from(READING_BOOKS_BUCKET)
      .remove([path]);
    if (rmError) {
      console.error('deleteCloudSession storage remove failed:', rmError);
    }
  }

  const { data, error } = await supabase
    .from('reading_sessions')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('deleteCloudSession failed:', error);
    throw new Error(error.message);
  }

  return Array.isArray(data) && data.length > 0;
}

export async function createSignedUpload(path: string): Promise<{
  signedUrl: string;
  token: string;
  path: string;
}> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(READING_BOOKS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error('createSignedUpload failed:', error);
    throw new Error(error?.message || '无法创建上传凭证');
  }

  return {
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
  };
}

export async function createSignedDownload(
  path: string,
  expiresIn = 3600
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(READING_BOOKS_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    console.error('createSignedDownload failed:', error);
    throw new Error(error?.message || '无法创建下载链接');
  }

  return data.signedUrl;
}

function rowToAnnotation(row: AnnotationRow): ReadingAnnotation {
  return {
    id: row.id,
    bookTitle: row.book_title,
    chapterIndex: row.chapter_index,
    chapterTitle: row.chapter_title,
    quote: row.quote,
    note: row.note,
    color: row.color,
    createdAt: row.created_at,
    synced: true,
  };
}

export async function listCloudAnnotations(): Promise<ReadingAnnotation[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('reading_annotations')
    .select(
      'id, book_title, chapter_index, chapter_title, quote, note, color, created_at, updated_at'
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('listCloudAnnotations failed:', error);
    throw new Error(error.message);
  }

  return ((data as AnnotationRow[] | null) ?? []).map(rowToAnnotation);
}

export async function upsertCloudAnnotations(
  items: ReadingAnnotation[]
): Promise<ReadingAnnotation[]> {
  if (items.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const rows = items.map((a) => ({
    id: a.id,
    book_title: a.bookTitle,
    chapter_index: a.chapterIndex,
    chapter_title: a.chapterTitle,
    quote: a.quote,
    note: a.note,
    color: a.color,
    created_at: a.createdAt,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('reading_annotations')
    .upsert(rows, { onConflict: 'id' })
    .select(
      'id, book_title, chapter_index, chapter_title, quote, note, color, created_at, updated_at'
    );

  if (error) {
    console.error('upsertCloudAnnotations failed:', error);
    throw new Error(error.message);
  }

  return ((data as AnnotationRow[] | null) ?? []).map(rowToAnnotation);
}

export async function deleteCloudAnnotation(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('reading_annotations')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('deleteCloudAnnotation failed:', error);
    throw new Error(error.message);
  }

  return Array.isArray(data) && data.length > 0;
}

export async function deleteCloudAnnotationsByBook(
  bookTitle: string
): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('reading_annotations')
    .delete()
    .eq('book_title', bookTitle)
    .select('id');

  if (error) {
    console.error('deleteCloudAnnotationsByBook failed:', error);
    throw new Error(error.message);
  }

  return Array.isArray(data) ? data.length : 0;
}

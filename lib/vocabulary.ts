import { getSupabaseAdmin } from '@/lib/supabase/admin';

export interface VocabEntry {
  id: string;
  english: string;
  chinese: string;
  source?: string;
  createdAt: string;
  updatedAt?: string;
}

interface VocabRow {
  id: string;
  english: string;
  chinese: string;
  source: string | null;
  created_at: string;
  updated_at: string | null;
}

function rowToEntry(row: VocabRow): VocabEntry {
  return {
    id: row.id,
    english: row.english,
    chinese: row.chinese ?? '',
    createdAt: row.created_at,
    ...(row.source ? { source: row.source } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
  };
}

export async function getAllVocab(): Promise<VocabEntry[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('vocab_entries')
      .select('id, english, chinese, source, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('getAllVocab failed:', error);
      return [];
    }

    return (data as VocabRow[] | null)?.map(rowToEntry) ?? [];
  } catch (error) {
    console.error('getAllVocab fallback:', error);
    return [];
  }
}

export async function insertVocab(entry: {
  english: string;
  chinese?: string;
  source?: string;
  id?: string;
  createdAt?: string;
}): Promise<VocabEntry> {
  const english = entry.english.trim();
  if (!english) throw new Error('英文不能为空');

  const chinese = (entry.chinese ?? '').trim();
  const id = entry.id ?? `v${Date.now()}`;
  const now = new Date().toISOString();
  const createdAt =
    entry.createdAt && !Number.isNaN(new Date(entry.createdAt).getTime())
      ? new Date(entry.createdAt).toISOString()
      : now;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('vocab_entries')
    .insert({
      id,
      english,
      chinese,
      source: entry.source?.trim() || null,
      created_at: createdAt,
      updated_at: now,
    })
    .select('id, english, chinese, source, created_at, updated_at')
    .single();

  if (error) {
    console.error('insertVocab failed:', error);
    throw new Error(error.message);
  }

  return rowToEntry(data as VocabRow);
}

export async function updateVocab(
  id: string,
  meta: { english?: string; chinese?: string; source?: string }
): Promise<VocabEntry | null> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (meta.english !== undefined) {
    const english = meta.english.trim();
    if (!english) throw new Error('英文不能为空');
    patch.english = english;
  }
  if (meta.chinese !== undefined) patch.chinese = meta.chinese.trim();
  if (meta.source !== undefined) {
    patch.source = meta.source.trim() || null;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('vocab_entries')
    .update(patch)
    .eq('id', id)
    .select('id, english, chinese, source, created_at, updated_at')
    .maybeSingle();

  if (error) {
    console.error('updateVocab failed:', error);
    throw new Error(error.message);
  }

  return data ? rowToEntry(data as VocabRow) : null;
}

export async function deleteVocab(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('vocab_entries')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('deleteVocab failed:', error);
    throw new Error(error.message);
  }

  return Array.isArray(data) && data.length > 0;
}

/** 同英文已存在则更新中文/来源，否则新建 */
export async function upsertVocabByEnglish(entry: {
  english: string;
  chinese?: string;
  source?: string;
  createdAt?: string;
}): Promise<{ entry: VocabEntry; merged: boolean }> {
  const english = entry.english.trim();
  if (!english) throw new Error('英文不能为空');

  const supabase = getSupabaseAdmin();
  const { data: existing, error: findError } = await supabase
    .from('vocab_entries')
    .select('id, english, chinese, source, created_at, updated_at')
    .eq('english', english)
    .limit(1)
    .maybeSingle();

  if (findError) {
    console.error('upsertVocabByEnglish find failed:', findError);
    throw new Error(findError.message);
  }

  if (existing) {
    const row = existing as VocabRow;
    const chinese =
      entry.chinese !== undefined && entry.chinese.trim()
        ? entry.chinese.trim()
        : row.chinese;
    const source =
      entry.source !== undefined
        ? entry.source.trim() || undefined
        : row.source || undefined;
    const updated = await updateVocab(row.id, { chinese, source });
    if (!updated) throw new Error('更新失败');
    return { entry: updated, merged: true };
  }

  const created = await insertVocab({
    english,
    chinese: entry.chinese,
    source: entry.source,
    createdAt: entry.createdAt,
  });
  return { entry: created, merged: false };
}

export interface VocabImportItem {
  english: string;
  chinese?: string;
  source?: string;
  createdAt?: string;
}

/** 批量导入：按英文合并；新建时保留导入里的日期 */
export async function importVocabBatch(
  items: VocabImportItem[]
): Promise<{ added: number; merged: number; skipped: number }> {
  let added = 0;
  let merged = 0;
  let skipped = 0;

  for (const item of items) {
    const english = String(item.english ?? '').trim();
    if (!english) {
      skipped += 1;
      continue;
    }
    const result = await upsertVocabByEnglish({
      english,
      chinese: item.chinese,
      source: item.source,
      createdAt: item.createdAt,
    });
    if (result.merged) merged += 1;
    else added += 1;
  }

  return { added, merged, skipped };
}

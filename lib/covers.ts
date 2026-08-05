import { bookCovers, type BookCover } from '@/data/content';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const BUCKET = 'covers';

interface UserCoverRow {
  id: string;
  image_url: string;
  title: string | null;
  designer: string | null;
  tags: string[] | null;
}

interface CoverOverrideRow {
  id: string;
  title: string | null;
  designer: string | null;
  tags: string[] | null;
  image_url: string | null;
}

function rowToCover(row: UserCoverRow): BookCover {
  const cover: BookCover = { id: row.id, imageUrl: row.image_url };
  if (row.title) cover.title = row.title;
  if (row.designer) cover.designer = row.designer;
  if (row.tags?.length) cover.tags = row.tags;
  return cover;
}

function overrideToPartial(row: CoverOverrideRow): Partial<BookCover> {
  const partial: Partial<BookCover> = {};
  if (row.title) partial.title = row.title;
  if (row.designer) partial.designer = row.designer;
  if (row.tags?.length) partial.tags = row.tags;
  if (row.image_url) partial.imageUrl = row.image_url;
  return partial;
}

function applyOverride(
  cover: BookCover,
  override?: Partial<BookCover>
): BookCover {
  if (!override) return cover;
  return {
    ...cover,
    ...override,
    id: cover.id,
    imageUrl: override.imageUrl || cover.imageUrl,
  };
}

function buildCover(
  id: string,
  imageUrl: string,
  meta: { title?: string; designer?: string; tags?: string[] }
): BookCover {
  const cover: BookCover = { id, imageUrl };
  if (meta.title?.trim()) cover.title = meta.title.trim();
  if (meta.designer?.trim()) cover.designer = meta.designer.trim();
  if (meta.tags?.length) cover.tags = meta.tags;
  return cover;
}

function storageObjectPathFromUrl(imageUrl: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx >= 0) return decodeURIComponent(imageUrl.slice(idx + marker.length));
  return null;
}

export async function readUserCovers(): Promise<BookCover[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_covers')
    .select('id, image_url, title, designer, tags')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('readUserCovers failed:', error);
    throw new Error(error.message);
  }

  return (data as UserCoverRow[] | null)?.map(rowToCover) ?? [];
}

export async function insertUserCover(cover: BookCover): Promise<BookCover> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_covers')
    .insert({
      id: cover.id,
      image_url: cover.imageUrl,
      title: cover.title ?? null,
      designer: cover.designer ?? null,
      tags: cover.tags ?? [],
    })
    .select('id, image_url, title, designer, tags')
    .single();

  if (error) {
    console.error('insertUserCover failed:', error);
    throw new Error(error.message);
  }

  const saved = rowToCover(data as UserCoverRow);
  await appendCoverToOrder(saved.id);
  return saved;
}

async function readOverrides(): Promise<Record<string, Partial<BookCover>>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('cover_overrides')
    .select('id, title, designer, tags, image_url');

  if (error) {
    console.error('readCoverOverrides failed:', error);
    throw new Error(error.message);
  }

  const map: Record<string, Partial<BookCover>> = {};
  for (const row of (data as CoverOverrideRow[] | null) ?? []) {
    map[row.id] = overrideToPartial(row);
  }
  return map;
}

async function readDeletedIds(): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('deleted_covers').select('id');

  if (error) {
    console.error('readDeletedCovers failed:', error);
    throw new Error(error.message);
  }

  return ((data as { id: string }[] | null) ?? []).map((r) => r.id);
}

async function readCoverOrderIds(): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('cover_order')
    .select('cover_ids')
    .eq('id', 'default')
    .maybeSingle();

  if (error) {
    console.error('readCoverOrderIds failed:', error);
    throw new Error(error.message);
  }

  const ids = (data as { cover_ids?: string[] } | null)?.cover_ids;
  return Array.isArray(ids) ? ids : [];
}

function applyCoverOrder(covers: BookCover[], orderIds: string[]): BookCover[] {
  if (orderIds.length === 0) return covers;

  const byId = new Map(covers.map((c) => [c.id, c]));
  const ordered: BookCover[] = [];

  for (const id of orderIds) {
    const cover = byId.get(id);
    if (cover) {
      ordered.push(cover);
      byId.delete(id);
    }
  }

  for (const cover of byId.values()) {
    ordered.push(cover);
  }

  return ordered;
}

export async function saveCoverOrder(coverIds: string[]): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const unique = Array.from(new Set(coverIds.map((id) => id.trim()).filter(Boolean)));

  const { data, error } = await supabase
    .from('cover_order')
    .upsert(
      {
        id: 'default',
        cover_ids: unique,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('cover_ids')
    .single();

  if (error) {
    console.error('saveCoverOrder failed:', error);
    throw new Error(error.message);
  }

  return (data as { cover_ids: string[] }).cover_ids ?? unique;
}

async function appendCoverToOrder(id: string): Promise<void> {
  const current = await readCoverOrderIds();
  // 尚未自定义过排序时不写入，保持「内置在前、用户在后」的默认顺序
  if (current.length === 0) return;
  if (current.includes(id)) return;
  await saveCoverOrder([...current, id]);
}

async function removeCoverFromOrder(id: string): Promise<void> {
  const current = await readCoverOrderIds();
  if (!current.includes(id)) return;
  await saveCoverOrder(current.filter((x) => x !== id));
}

export async function getAllCovers(): Promise<BookCover[]> {
  const [userCovers, overrides, deleted, orderIds] = await Promise.all([
    readUserCovers(),
    readOverrides(),
    readDeletedIds(),
    readCoverOrderIds(),
  ]);
  const deletedSet = new Set(deleted);

  const builtin = bookCovers
    .filter((c) => !deletedSet.has(c.id))
    .map((c) => applyOverride(c, overrides[c.id]));

  const users = userCovers
    .filter((c) => !deletedSet.has(c.id))
    .map((c) => applyOverride(c, overrides[c.id]));

  return applyCoverOrder([...builtin, ...users], orderIds);
}

export async function uploadCoverImage(
  objectPath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    console.error('uploadCoverImage failed:', error);
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

export async function removeCoverImageIfStored(imageUrl: string): Promise<void> {
  const objectPath = storageObjectPathFromUrl(imageUrl);
  if (!objectPath) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).remove([objectPath]);
  if (error) {
    console.error('removeCoverImageIfStored failed:', error);
  }
}

export async function updateCoverMeta(
  id: string,
  meta: {
    title?: string;
    designer?: string;
    tags?: string[];
    imageUrl?: string;
  }
): Promise<BookCover | null> {
  const supabase = getSupabaseAdmin();
  const userCovers = await readUserCovers();
  const userIndex = userCovers.findIndex((c) => c.id === id);

  if (userIndex >= 0) {
    const current = userCovers[userIndex];
    const next = buildCover(id, meta.imageUrl || current.imageUrl, {
      title: meta.title !== undefined ? meta.title : current.title,
      designer: meta.designer !== undefined ? meta.designer : current.designer,
      tags: meta.tags !== undefined ? meta.tags : current.tags,
    });

    if (meta.imageUrl && current.imageUrl !== meta.imageUrl) {
      await removeCoverImageIfStored(current.imageUrl);
    }

    const { data, error } = await supabase
      .from('user_covers')
      .update({
        image_url: next.imageUrl,
        title: next.title ?? null,
        designer: next.designer ?? null,
        tags: next.tags ?? [],
      })
      .eq('id', id)
      .select('id, image_url, title, designer, tags')
      .single();

    if (error) {
      console.error('updateCoverMeta user failed:', error);
      throw new Error(error.message);
    }

    return rowToCover(data as UserCoverRow);
  }

  const builtin = bookCovers.find((c) => c.id === id);
  if (!builtin) return null;

  const overrides = await readOverrides();
  const prev = overrides[id] || {};
  const nextOverride: Partial<BookCover> = { ...prev };

  if (meta.title !== undefined) {
    if (meta.title.trim()) nextOverride.title = meta.title.trim();
    else delete nextOverride.title;
  }
  if (meta.designer !== undefined) {
    if (meta.designer.trim()) nextOverride.designer = meta.designer.trim();
    else delete nextOverride.designer;
  }
  if (meta.tags !== undefined) {
    if (meta.tags.length) nextOverride.tags = meta.tags;
    else delete nextOverride.tags;
  }
  if (meta.imageUrl) {
    if (prev.imageUrl && prev.imageUrl !== meta.imageUrl) {
      await removeCoverImageIfStored(prev.imageUrl);
    }
    nextOverride.imageUrl = meta.imageUrl;
  }

  const { error } = await supabase.from('cover_overrides').upsert(
    {
      id,
      title: nextOverride.title ?? null,
      designer: nextOverride.designer ?? null,
      tags: nextOverride.tags ?? null,
      image_url: nextOverride.imageUrl ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('updateCoverMeta override failed:', error);
    throw new Error(error.message);
  }

  return applyOverride(builtin, nextOverride);
}

export async function deleteCoverById(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const userCovers = await readUserCovers();
  const user = userCovers.find((c) => c.id === id);

  if (user) {
    const { error } = await supabase.from('user_covers').delete().eq('id', id);
    if (error) {
      console.error('deleteCoverById user failed:', error);
      throw new Error(error.message);
    }
    await removeCoverImageIfStored(user.imageUrl);
    await removeCoverFromOrder(id);
    return true;
  }

  const builtin = bookCovers.find((c) => c.id === id);
  if (!builtin) return false;

  const { error: delError } = await supabase
    .from('deleted_covers')
    .upsert({ id }, { onConflict: 'id' });
  if (delError) {
    console.error('deleteCoverById mark deleted failed:', delError);
    throw new Error(delError.message);
  }

  const overrides = await readOverrides();
  if (overrides[id]?.imageUrl) {
    await removeCoverImageIfStored(overrides[id].imageUrl!);
  }

  const { error: ovError } = await supabase
    .from('cover_overrides')
    .delete()
    .eq('id', id);
  if (ovError) {
    console.error('deleteCoverById clear override failed:', ovError);
    throw new Error(ovError.message);
  }

  await removeCoverFromOrder(id);
  return true;
}

/** @deprecated 本地目录已停用；保留空实现避免旧引用报错 */
export async function ensureCoversDir(): Promise<void> {}

/** @deprecated */
export function getCoversDir(): string {
  return '';
}

/** @deprecated 已改为 insertUserCover */
export async function writeUserCovers(_covers: BookCover[]): Promise<void> {
  throw new Error('writeUserCovers 已停用，请使用 insertUserCover');
}

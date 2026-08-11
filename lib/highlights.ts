import { highlightGroups, type HighlightGroup } from '@/data/content';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

type HighlightOverride = {
  bookTitle?: string;
  author?: string;
  quotes?: string[];
};

interface UserHighlightRow {
  id: string;
  book_title: string;
  author: string | null;
  quotes: unknown;
}

interface HighlightOverrideRow {
  id: string;
  book_title: string | null;
  author: string | null;
  quotes: unknown;
}

function parseQuotes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((q) => String(q ?? '').trim()).filter(Boolean);
}

function rowToGroup(row: UserHighlightRow): HighlightGroup {
  const group: HighlightGroup = {
    id: row.id,
    bookTitle: row.book_title,
    quotes: parseQuotes(row.quotes),
  };
  if (row.author) group.author = row.author;
  return group;
}

function overrideFromRow(row: HighlightOverrideRow): HighlightOverride {
  const override: HighlightOverride = {};
  if (row.book_title) override.bookTitle = row.book_title;
  if (row.author !== null && row.author !== undefined) {
    override.author = row.author;
  }
  if (row.quotes !== null && row.quotes !== undefined) {
    override.quotes = parseQuotes(row.quotes);
  }
  return override;
}

function applyOverride(
  group: HighlightGroup,
  override?: HighlightOverride
): HighlightGroup {
  if (!override) return group;

  const next: HighlightGroup = {
    id: group.id,
    bookTitle: override.bookTitle ?? group.bookTitle,
    quotes: override.quotes ?? group.quotes,
  };

  if (override.author !== undefined) {
    if (override.author.trim()) next.author = override.author.trim();
  } else if (group.author) {
    next.author = group.author;
  }

  return next;
}

function buildGroup(
  id: string,
  meta: { bookTitle: string; author?: string; quotes: string[] }
): HighlightGroup {
  const group: HighlightGroup = {
    id,
    bookTitle: meta.bookTitle.trim(),
    quotes: meta.quotes.map((q) => q.trim()).filter(Boolean),
  };
  if (meta.author?.trim()) group.author = meta.author.trim();
  return group;
}

export async function readUserHighlights(): Promise<HighlightGroup[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_highlights')
    .select('id, book_title, author, quotes')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('readUserHighlights failed:', error);
    throw new Error(error.message);
  }

  return (data as UserHighlightRow[] | null)?.map(rowToGroup) ?? [];
}

export async function insertUserHighlight(
  group: HighlightGroup
): Promise<HighlightGroup> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('user_highlights')
    .insert({
      id: group.id,
      book_title: group.bookTitle,
      author: group.author ?? null,
      quotes: group.quotes,
      created_at: now,
      updated_at: now,
    })
    .select('id, book_title, author, quotes')
    .single();

  if (error) {
    console.error('insertUserHighlight failed:', error);
    throw new Error(error.message);
  }

  return rowToGroup(data as UserHighlightRow);
}

export async function findUserHighlightByTitle(
  bookTitle: string
): Promise<HighlightGroup | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_highlights')
    .select('id, book_title, author, quotes')
    .eq('book_title', bookTitle)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('findUserHighlightByTitle failed:', error);
    throw new Error(error.message);
  }

  return data ? rowToGroup(data as UserHighlightRow) : null;
}

async function readOverrides(): Promise<Record<string, HighlightOverride>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('highlight_overrides')
    .select('id, book_title, author, quotes');

  if (error) {
    console.error('readHighlightOverrides failed:', error);
    throw new Error(error.message);
  }

  const map: Record<string, HighlightOverride> = {};
  for (const row of (data as HighlightOverrideRow[] | null) ?? []) {
    map[row.id] = overrideFromRow(row);
  }
  return map;
}

async function readDeletedIds(): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('deleted_highlights').select('id');

  if (error) {
    console.error('readDeletedHighlights failed:', error);
    throw new Error(error.message);
  }

  return ((data as { id: string }[] | null) ?? []).map((r) => r.id);
}

export async function getAllHighlights(): Promise<HighlightGroup[]> {
  try {
    const [userHighlights, overrides, deleted] = await Promise.all([
      readUserHighlights(),
      readOverrides(),
      readDeletedIds(),
    ]);
    const deletedSet = new Set(deleted);

    const builtin = highlightGroups
      .filter((g) => !deletedSet.has(g.id))
      .map((g) => applyOverride(g, overrides[g.id]));

    const users = userHighlights
      .filter((g) => !deletedSet.has(g.id))
      .map((g) => applyOverride(g, overrides[g.id]));

    return [...builtin, ...users];
  } catch (error) {
    console.error('getAllHighlights fallback to builtins:', error);
    return [...highlightGroups];
  }
}

async function findGroup(id: string): Promise<HighlightGroup | null> {
  const userHighlights = await readUserHighlights();
  const user = userHighlights.find((g) => g.id === id);
  if (user) return user;

  const deleted = await readDeletedIds();
  if (deleted.includes(id)) return null;

  const builtin = highlightGroups.find((g) => g.id === id);
  if (!builtin) return null;

  const overrides = await readOverrides();
  return applyOverride(builtin, overrides[id]);
}

async function persistGroup(next: HighlightGroup): Promise<HighlightGroup> {
  const supabase = getSupabaseAdmin();
  const userHighlights = await readUserHighlights();
  const isUser = userHighlights.some((g) => g.id === next.id);

  if (isUser) {
    const { data, error } = await supabase
      .from('user_highlights')
      .update({
        book_title: next.bookTitle,
        author: next.author ?? null,
        quotes: next.quotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', next.id)
      .select('id, book_title, author, quotes')
      .single();

    if (error) {
      console.error('persistGroup user failed:', error);
      throw new Error(error.message);
    }

    return rowToGroup(data as UserHighlightRow);
  }

  const builtin = highlightGroups.find((g) => g.id === next.id);
  if (!builtin) throw new Error('not found');

  const { error } = await supabase.from('highlight_overrides').upsert(
    {
      id: next.id,
      book_title: next.bookTitle,
      author: next.author ?? '',
      quotes: next.quotes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('persistGroup override failed:', error);
    throw new Error(error.message);
  }

  return next;
}

export async function updateHighlightGroup(
  id: string,
  meta: { bookTitle: string; author?: string; quotes: string[] }
): Promise<HighlightGroup | null> {
  const found = await findGroup(id);
  if (!found) return null;

  const next = buildGroup(id, meta);
  if (next.quotes.length === 0) return null;

  return persistGroup(next);
}

export async function updateHighlightQuote(
  id: string,
  quoteIndex: number,
  text: string
): Promise<HighlightGroup | null> {
  const found = await findGroup(id);
  if (!found) return null;

  const trimmed = text.trim();
  if (!trimmed) return null;
  if (quoteIndex < 0 || quoteIndex >= found.quotes.length) return null;

  const quotes = [...found.quotes];
  quotes[quoteIndex] = trimmed;

  return persistGroup(
    buildGroup(id, {
      bookTitle: found.bookTitle,
      author: found.author,
      quotes,
    })
  );
}

export async function deleteHighlightQuote(
  id: string,
  quoteIndex: number
): Promise<{ group: HighlightGroup | null; deletedGroup: boolean } | null> {
  const found = await findGroup(id);
  if (!found) return null;
  if (quoteIndex < 0 || quoteIndex >= found.quotes.length) return null;

  const quotes = found.quotes.filter((_, i) => i !== quoteIndex);

  if (quotes.length === 0) {
    const ok = await deleteHighlightGroup(id);
    return ok ? { group: null, deletedGroup: true } : null;
  }

  const group = await persistGroup(
    buildGroup(id, {
      bookTitle: found.bookTitle,
      author: found.author,
      quotes,
    })
  );
  return { group, deletedGroup: false };
}

export async function deleteHighlightGroup(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const userHighlights = await readUserHighlights();
  const isUser = userHighlights.some((g) => g.id === id);

  if (isUser) {
    const { error } = await supabase.from('user_highlights').delete().eq('id', id);
    if (error) {
      console.error('deleteHighlightGroup user failed:', error);
      throw new Error(error.message);
    }
    return true;
  }

  const builtin = highlightGroups.find((g) => g.id === id);
  if (!builtin) return false;

  const { error: delError } = await supabase
    .from('deleted_highlights')
    .upsert({ id }, { onConflict: 'id' });
  if (delError) {
    console.error('deleteHighlightGroup mark deleted failed:', delError);
    throw new Error(delError.message);
  }

  const { error: ovError } = await supabase
    .from('highlight_overrides')
    .delete()
    .eq('id', id);
  if (ovError) {
    console.error('deleteHighlightGroup clear override failed:', ovError);
    throw new Error(ovError.message);
  }

  return true;
}

/** @deprecated 已改为 insertUserHighlight / persist 单条更新 */
export async function writeUserHighlights(
  _groups: HighlightGroup[]
): Promise<void> {
  throw new Error('writeUserHighlights 已停用，请使用 insertUserHighlight');
}

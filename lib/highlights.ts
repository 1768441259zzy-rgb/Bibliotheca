import { promises as fs } from 'fs';
import path from 'path';
import { highlightGroups, type HighlightGroup } from '@/data/content';

const USER_PATH = path.join(process.cwd(), 'data', 'user-highlights.json');
const OVERRIDES_PATH = path.join(
  process.cwd(),
  'data',
  'highlight-overrides.json'
);
const DELETED_PATH = path.join(process.cwd(), 'data', 'deleted-highlights.json');

type HighlightOverride = {
  bookTitle?: string;
  author?: string;
  quotes?: string[];
};

export async function readUserHighlights(): Promise<HighlightGroup[]> {
  try {
    const raw = await fs.readFile(USER_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as HighlightGroup[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeUserHighlights(
  groups: HighlightGroup[]
): Promise<void> {
  await fs.writeFile(USER_PATH, JSON.stringify(groups, null, 2) + '\n', 'utf-8');
}

async function readOverrides(): Promise<Record<string, HighlightOverride>> {
  try {
    const raw = await fs.readFile(OVERRIDES_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, HighlightOverride>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeOverrides(
  overrides: Record<string, HighlightOverride>
): Promise<void> {
  await fs.writeFile(
    OVERRIDES_PATH,
    JSON.stringify(overrides, null, 2) + '\n',
    'utf-8'
  );
}

async function readDeletedIds(): Promise<string[]> {
  try {
    const raw = await fs.readFile(DELETED_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeDeletedIds(ids: string[]): Promise<void> {
  await fs.writeFile(DELETED_PATH, JSON.stringify(ids, null, 2) + '\n', 'utf-8');
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

export async function getAllHighlights(): Promise<HighlightGroup[]> {
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
  const userHighlights = await readUserHighlights();
  const userIndex = userHighlights.findIndex((g) => g.id === next.id);

  if (userIndex >= 0) {
    userHighlights[userIndex] = next;
    await writeUserHighlights(userHighlights);
    return next;
  }

  const builtin = highlightGroups.find((g) => g.id === next.id);
  if (!builtin) throw new Error('not found');

  const overrides = await readOverrides();
  const clean: HighlightOverride = {
    bookTitle: next.bookTitle,
    quotes: next.quotes,
    author: next.author ?? '',
  };
  overrides[next.id] = clean;
  await writeOverrides(overrides);
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
  const userHighlights = await readUserHighlights();
  const userIndex = userHighlights.findIndex((g) => g.id === id);

  if (userIndex >= 0) {
    userHighlights.splice(userIndex, 1);
    await writeUserHighlights(userHighlights);
    return true;
  }

  const builtin = highlightGroups.find((g) => g.id === id);
  if (!builtin) return false;

  const deleted = await readDeletedIds();
  if (!deleted.includes(id)) {
    deleted.push(id);
    await writeDeletedIds(deleted);
  }

  const overrides = await readOverrides();
  if (overrides[id]) {
    delete overrides[id];
    await writeOverrides(overrides);
  }

  return true;
}

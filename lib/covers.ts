import { promises as fs } from 'fs';
import path from 'path';
import { bookCovers, type BookCover } from '@/data/content';

const USER_COVERS_PATH = path.join(process.cwd(), 'data', 'user-covers.json');
const OVERRIDES_PATH = path.join(process.cwd(), 'data', 'cover-overrides.json');
const DELETED_PATH = path.join(process.cwd(), 'data', 'deleted-covers.json');
const COVERS_DIR = path.join(process.cwd(), 'public', 'assets', 'covers');

export async function readUserCovers(): Promise<BookCover[]> {
  try {
    const raw = await fs.readFile(USER_COVERS_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as BookCover[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeUserCovers(covers: BookCover[]): Promise<void> {
  await fs.writeFile(
    USER_COVERS_PATH,
    JSON.stringify(covers, null, 2) + '\n',
    'utf-8'
  );
}

async function readOverrides(): Promise<Record<string, Partial<BookCover>>> {
  try {
    const raw = await fs.readFile(OVERRIDES_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, Partial<BookCover>>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeOverrides(
  overrides: Record<string, Partial<BookCover>>
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

export async function getAllCovers(): Promise<BookCover[]> {
  const [userCovers, overrides, deleted] = await Promise.all([
    readUserCovers(),
    readOverrides(),
    readDeletedIds(),
  ]);
  const deletedSet = new Set(deleted);

  const builtin = bookCovers
    .filter((c) => !deletedSet.has(c.id))
    .map((c) => applyOverride(c, overrides[c.id]));

  const users = userCovers
    .filter((c) => !deletedSet.has(c.id))
    .map((c) => applyOverride(c, overrides[c.id]));

  return [...builtin, ...users];
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
  const userCovers = await readUserCovers();
  const userIndex = userCovers.findIndex((c) => c.id === id);

  if (userIndex >= 0) {
    const current = userCovers[userIndex];
    const next = buildCover(id, meta.imageUrl || current.imageUrl, {
      title: meta.title !== undefined ? meta.title : current.title,
      designer: meta.designer !== undefined ? meta.designer : current.designer,
      tags: meta.tags !== undefined ? meta.tags : current.tags,
    });
    userCovers[userIndex] = next;
    await writeUserCovers(userCovers);
    return next;
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
  if (meta.imageUrl) nextOverride.imageUrl = meta.imageUrl;

  overrides[id] = nextOverride;
  await writeOverrides(overrides);
  return applyOverride(builtin, nextOverride);
}

export async function deleteCoverById(id: string): Promise<boolean> {
  const userCovers = await readUserCovers();
  const userIndex = userCovers.findIndex((c) => c.id === id);

  if (userIndex >= 0) {
    const [removed] = userCovers.splice(userIndex, 1);
    await writeUserCovers(userCovers);

    if (removed.imageUrl?.startsWith('/assets/covers/')) {
      const filename = removed.imageUrl.replace('/assets/covers/', '');
      const filepath = path.join(COVERS_DIR, filename);
      try {
        await fs.unlink(filepath);
      } catch {
        // ignore missing file
      }
    }
    return true;
  }

  const builtin = bookCovers.find((c) => c.id === id);
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

export async function ensureCoversDir(): Promise<void> {
  await fs.mkdir(COVERS_DIR, { recursive: true });
}

export function getCoversDir(): string {
  return COVERS_DIR;
}

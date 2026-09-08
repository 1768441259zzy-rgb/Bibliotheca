import { promises as fs } from 'fs';
import path from 'path';
import type { BookCover, HighlightGroup } from '@/data/content';

async function readJsonFile<T>(rel: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), rel), 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 仓库内 JSON 备份：Supabase 读失败时用来保住用户内容 */
export async function readLocalUserCovers(): Promise<BookCover[]> {
  const parsed = await readJsonFile<BookCover[]>('data/user-covers.json', []);
  return Array.isArray(parsed) ? parsed : [];
}

export async function readLocalUserHighlights(): Promise<HighlightGroup[]> {
  const parsed = await readJsonFile<HighlightGroup[]>(
    'data/user-highlights.json',
    []
  );
  return Array.isArray(parsed) ? parsed : [];
}

export async function readLocalHighlightOverrides(): Promise<
  Record<string, Partial<HighlightGroup>>
> {
  const parsed = await readJsonFile<Record<string, Partial<HighlightGroup>>>(
    'data/highlight-overrides.json',
    {}
  );
  return parsed && typeof parsed === 'object' ? parsed : {};
}

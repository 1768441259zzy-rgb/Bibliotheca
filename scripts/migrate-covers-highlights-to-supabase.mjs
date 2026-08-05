/**
 * 一次性：把本地 Cover / Highlights JSON（及封面图片）导入 Supabase
 * 用法（在项目根目录）：
 *   node scripts/migrate-covers-highlights-to-supabase.mjs
 *
 * 请先在 Supabase SQL Editor 执行 supabase/covers-highlights.sql
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BUCKET = 'covers';

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local');
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function readJson(rel, fallback) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function contentTypeForExt(ext) {
  switch (ext.toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'image/jpeg';
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function uploadLocalCover(imageUrl) {
  if (!imageUrl?.startsWith('/assets/covers/')) return imageUrl;
  const filename = imageUrl.replace('/assets/covers/', '');
  const localPath = path.join(root, 'public', 'assets', 'covers', filename);
  if (!fs.existsSync(localPath)) {
    console.warn(`跳过缺失图片: ${localPath}`);
    return imageUrl;
  }
  const buffer = fs.readFileSync(localPath);
  const ext = path.extname(filename) || '.jpg';
  const objectPath = filename.startsWith('cover-') ? filename : `migrated-${filename}`;
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
    contentType: contentTypeForExt(ext),
    upsert: true,
  });
  if (error) throw new Error(`上传 ${filename} 失败: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

// —— covers ——
const userCovers = readJson('data/user-covers.json', []);
const coverOverrides = readJson('data/cover-overrides.json', {});
const deletedCovers = readJson('data/deleted-covers.json', []);

if (Array.isArray(userCovers) && userCovers.length) {
  const rows = [];
  for (const c of userCovers) {
    const image_url = await uploadLocalCover(c.imageUrl);
    rows.push({
      id: c.id,
      image_url,
      title: c.title ?? null,
      designer: c.designer ?? null,
      tags: c.tags ?? [],
    });
  }
  const { error } = await supabase
    .from('user_covers')
    .upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error('导入 user_covers 失败：', error.message);
    process.exit(1);
  }
  console.log(`已导入 ${rows.length} 条用户封面`);
} else {
  console.log('无用户封面需要导入');
}

const overrideEntries = Object.entries(coverOverrides || {});
if (overrideEntries.length) {
  const rows = [];
  for (const [id, o] of overrideEntries) {
    let image_url = o.imageUrl ?? null;
    if (image_url) image_url = await uploadLocalCover(image_url);
    rows.push({
      id,
      title: o.title ?? null,
      designer: o.designer ?? null,
      tags: o.tags ?? null,
      image_url,
      updated_at: new Date().toISOString(),
    });
  }
  const { error } = await supabase
    .from('cover_overrides')
    .upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error('导入 cover_overrides 失败：', error.message);
    process.exit(1);
  }
  console.log(`已导入 ${rows.length} 条封面覆盖`);
}

if (Array.isArray(deletedCovers) && deletedCovers.length) {
  const { error } = await supabase
    .from('deleted_covers')
    .upsert(
      deletedCovers.map((id) => ({ id })),
      { onConflict: 'id' }
    );
  if (error) {
    console.error('导入 deleted_covers 失败：', error.message);
    process.exit(1);
  }
  console.log(`已导入 ${deletedCovers.length} 条已删封面 id`);
}

// —— highlights ——
const userHighlights = readJson('data/user-highlights.json', []);
const highlightOverrides = readJson('data/highlight-overrides.json', {});
const deletedHighlights = readJson('data/deleted-highlights.json', []);

if (Array.isArray(userHighlights) && userHighlights.length) {
  const now = new Date().toISOString();
  const rows = userHighlights.map((g) => ({
    id: g.id,
    book_title: g.bookTitle,
    author: g.author ?? null,
    quotes: g.quotes ?? [],
    created_at: now,
    updated_at: now,
  }));
  const { error } = await supabase
    .from('user_highlights')
    .upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error('导入 user_highlights 失败：', error.message);
    process.exit(1);
  }
  console.log(`已导入 ${rows.length} 组用户摘抄`);
} else {
  console.log('无用户摘抄需要导入');
}

const hlOverrideEntries = Object.entries(highlightOverrides || {});
if (hlOverrideEntries.length) {
  const rows = hlOverrideEntries.map(([id, o]) => ({
    id,
    book_title: o.bookTitle ?? null,
    author: o.author ?? null,
    quotes: o.quotes ?? null,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('highlight_overrides')
    .upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error('导入 highlight_overrides 失败：', error.message);
    process.exit(1);
  }
  console.log(`已导入 ${rows.length} 条摘抄覆盖`);
}

if (Array.isArray(deletedHighlights) && deletedHighlights.length) {
  const { error } = await supabase
    .from('deleted_highlights')
    .upsert(
      deletedHighlights.map((id) => ({ id })),
      { onConflict: 'id' }
    );
  if (error) {
    console.error('导入 deleted_highlights 失败：', error.message);
    process.exit(1);
  }
  console.log(`已导入 ${deletedHighlights.length} 条已删摘抄 id`);
}

console.log('完成。请确认 Cloudflare Build Variables 里已有 SUPABASE_* 密钥。');

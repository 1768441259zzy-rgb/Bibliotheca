/**
 * 一次性：把 data/messages.json 导入 Supabase
 * 用法（在项目根目录）：
 *   node scripts/migrate-messages-to-supabase.mjs
 *
 * 请先在 Supabase SQL Editor 执行 supabase/messages.sql
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

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

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const jsonPath = path.join(root, 'data', 'messages.json');
const messages = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
if (!Array.isArray(messages) || messages.length === 0) {
  console.log('没有需要导入的本地留言');
  process.exit(0);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const rows = messages.map((m) => ({
  id: m.id,
  name: m.name,
  contact: m.contact ?? null,
  content: m.content,
  stamp: m.stamp ?? null,
  created_at: m.createdAt || new Date().toISOString(),
}));

const { data, error } = await supabase
  .from('guest_messages')
  .upsert(rows, { onConflict: 'id' })
  .select('id');

if (error) {
  console.error('导入失败：', error.message);
  console.error('请确认已执行 supabase/messages.sql');
  process.exit(1);
}

console.log(`已导入 ${data?.length ?? 0} 条留言到 Supabase`);

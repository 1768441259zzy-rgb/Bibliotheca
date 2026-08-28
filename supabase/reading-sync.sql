-- 在 Supabase Dashboard → SQL Editor 中执行本文件一次
-- Reading Space 云端同步：书文件（Storage）+ 进度 + 感悟

-- ========== 阅读会话 ==========

create table if not exists reading_sessions (
  id text primary key,
  title text not null,
  format text not null check (format in ('txt', 'epub', 'pdf')),
  file_name text,
  storage_path text,
  storage_kind text not null default 'original'
    check (storage_kind in ('original', 'payload')),
  file_size bigint,
  mime_type text,
  chapter_index integer not null default 0,
  font_scale real not null default 1,
  scroll_top real not null default 0,
  page_count integer,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists reading_sessions_updated_at_idx
  on reading_sessions (updated_at desc);

create index if not exists reading_sessions_title_format_idx
  on reading_sessions (title, format);

alter table reading_sessions enable row level security;

drop policy if exists "Public read reading sessions" on reading_sessions;
create policy "Public read reading sessions"
  on reading_sessions for select to anon, authenticated using (true);

-- ========== 阅读感悟 / 划线 ==========

create table if not exists reading_annotations (
  id text primary key,
  book_title text not null,
  chapter_index integer not null default 0,
  chapter_title text not null default '',
  quote text not null default '',
  note text not null default '',
  color text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reading_annotations_book_title_idx
  on reading_annotations (book_title);

alter table reading_annotations enable row level security;

drop policy if exists "Public read reading annotations" on reading_annotations;
create policy "Public read reading annotations"
  on reading_annotations for select to anon, authenticated using (true);

-- ========== Storage ==========
-- Dashboard → Storage → New bucket
--   Name: reading-books
--   Public: OFF（仅服务端签名读写）
-- 或执行（需有 storage 权限）:
--
-- insert into storage.buckets (id, name, public, file_size_limit)
-- values ('reading-books', 'reading-books', false, 52428800)
-- on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- 在 Supabase Dashboard → SQL Editor 中执行本文件一次
-- Cover Art + Highlights 持久化（替代本地 data/*.json 与 public 写入）

-- ========== Covers ==========

create table if not exists user_covers (
  id text primary key,
  image_url text not null,
  title text,
  designer text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists cover_overrides (
  id text primary key,
  title text,
  designer text,
  tags text[],
  image_url text,
  updated_at timestamptz not null default now()
);

create table if not exists deleted_covers (
  id text primary key,
  deleted_at timestamptz not null default now()
);

alter table user_covers enable row level security;
alter table cover_overrides enable row level security;
alter table deleted_covers enable row level security;

drop policy if exists "Public read user covers" on user_covers;
create policy "Public read user covers"
  on user_covers for select to anon, authenticated using (true);

drop policy if exists "Public read cover overrides" on cover_overrides;
create policy "Public read cover overrides"
  on cover_overrides for select to anon, authenticated using (true);

drop policy if exists "Public read deleted covers" on deleted_covers;
create policy "Public read deleted covers"
  on deleted_covers for select to anon, authenticated using (true);

-- ========== Highlights ==========

create table if not exists user_highlights (
  id text primary key,
  book_title text not null,
  author text,
  quotes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_highlights_book_title_idx
  on user_highlights (book_title);

create table if not exists highlight_overrides (
  id text primary key,
  book_title text,
  author text,
  quotes jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists deleted_highlights (
  id text primary key,
  deleted_at timestamptz not null default now()
);

alter table user_highlights enable row level security;
alter table highlight_overrides enable row level security;
alter table deleted_highlights enable row level security;

drop policy if exists "Public read user highlights" on user_highlights;
create policy "Public read user highlights"
  on user_highlights for select to anon, authenticated using (true);

drop policy if exists "Public read highlight overrides" on highlight_overrides;
create policy "Public read highlight overrides"
  on highlight_overrides for select to anon, authenticated using (true);

drop policy if exists "Public read deleted highlights" on deleted_highlights;
create policy "Public read deleted highlights"
  on deleted_highlights for select to anon, authenticated using (true);

-- ========== Storage: cover images ==========

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read cover images" on storage.objects;
create policy "Public read cover images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'covers');

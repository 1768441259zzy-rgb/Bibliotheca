-- Vocabulary 单词本（Supabase SQL Editor 执行一次）

create table if not exists vocab_entries (
  id text primary key,
  english text not null,
  chinese text not null default '',
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vocab_entries_created_at_idx
  on vocab_entries (created_at desc);

create index if not exists vocab_entries_english_idx
  on vocab_entries (english);

alter table vocab_entries enable row level security;

drop policy if exists "Public read vocab entries" on vocab_entries;
create policy "Public read vocab entries"
  on vocab_entries for select
  to anon, authenticated
  using (true);

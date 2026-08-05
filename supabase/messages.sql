-- 在 Supabase Dashboard → SQL Editor 中执行本文件一次

create table if not exists guest_messages (
  id text primary key,
  name text not null,
  contact text,
  content text not null,
  stamp text,
  created_at timestamptz not null default now()
);

create index if not exists guest_messages_created_at_idx
  on guest_messages (created_at desc);

alter table guest_messages enable row level security;

-- 访客可读（公开墙）；写入/删除走服务端 Secret key，不开放给 anon
drop policy if exists "Public read guest messages" on guest_messages;
create policy "Public read guest messages"
  on guest_messages
  for select
  to anon, authenticated
  using (true);

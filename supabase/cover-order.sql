-- Cover Art 手动排序（执行一次）
-- 在 Supabase SQL Editor 中运行

create table if not exists cover_order (
  id text primary key default 'default',
  cover_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into cover_order (id, cover_ids)
values ('default', '{}')
on conflict (id) do nothing;

alter table cover_order enable row level security;

drop policy if exists "Public read cover order" on cover_order;
create policy "Public read cover order"
  on cover_order for select to anon, authenticated using (true);

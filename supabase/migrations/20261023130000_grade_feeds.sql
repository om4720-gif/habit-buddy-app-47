-- A grades link the owner connected, stored encrypted (the server encrypts it before saving).
create table if not exists public.grade_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  encrypted_url text not null,
  host text not null,
  enabled boolean not null default true,
  last_checked_at timestamptz,
  last_status text,
  created_at timestamptz not null default now()
);

alter table public.grade_feeds enable row level security;

create policy "Owner reads own grade feed" on public.grade_feeds
  for select using (auth.uid() = user_id);
create policy "Owner connects own grade feed" on public.grade_feeds
  for insert with check (auth.uid() = user_id);
create policy "Owner updates own grade feed" on public.grade_feeds
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner disconnects own grade feed" on public.grade_feeds
  for delete using (auth.uid() = user_id);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  category text default 'general',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived boolean default false
);

grant select, insert, update, delete on public.habits to authenticated;
grant all on public.habits to service_role;

alter table public.habits enable row level security;

create policy "Users can manage own habits"
on public.habits
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create table public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid references public.habits(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  completed_date date not null,
  created_at timestamptz default now(),
  unique(habit_id, completed_date)
);

grant select, insert, update, delete on public.habit_completions to authenticated;
grant all on public.habit_completions to service_role;

alter table public.habit_completions enable row level security;

create policy "Users can manage own completions"
on public.habit_completions
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create index idx_habit_completions_lookup on public.habit_completions(user_id, habit_id, completed_date);
create index idx_habits_user on public.habits(user_id, archived);
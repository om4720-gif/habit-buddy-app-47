create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  code text,
  color text default '#CE552F',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

grant select, insert, update, delete on public.courses to authenticated;
grant all on public.courses to service_role;

alter table public.courses enable row level security;

create policy "Users can manage own courses"
on public.courses
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create table public.lectures (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  lecture_date date,
  completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(course_id, title, lecture_date)
);

grant select, insert, update, delete on public.lectures to authenticated;
grant all on public.lectures to service_role;

alter table public.lectures enable row level security;

create policy "Users can manage own lectures"
on public.lectures
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create index idx_lectures_course on public.lectures(user_id, course_id, lecture_date);
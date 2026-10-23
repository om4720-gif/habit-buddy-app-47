-- Marks inside an assessment, and "best N out of M" rules, so the Grades page can keep them in the database.
alter table public.course_grade_items
  add column if not exists marks jsonb not null default '[]'::jsonb,
  add column if not exists best_count integer,
  add column if not exists expected_count integer;

alter table public.course_grade_items
  drop constraint if exists course_grade_items_best_count_check,
  add constraint course_grade_items_best_count_check check (best_count is null or best_count >= 1),
  drop constraint if exists course_grade_items_expected_count_check,
  add constraint course_grade_items_expected_count_check check (expected_count is null or expected_count >= 1);

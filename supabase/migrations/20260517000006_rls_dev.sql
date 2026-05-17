-- ExamGrid migration 7/7: development RLS policies
alter table public.institutes enable row level security;
alter table public.questions enable row level security;
alter table public.exams enable row level security;
alter table public.exam_sections enable row level security;
alter table public.exam_questions enable row level security;

drop policy if exists "dev_institutes_all" on public.institutes;
drop policy if exists "dev_questions_all" on public.questions;
drop policy if exists "dev_exams_all" on public.exams;
drop policy if exists "dev_exam_sections_all" on public.exam_sections;
drop policy if exists "dev_exam_questions_all" on public.exam_questions;

create policy "dev_institutes_all" on public.institutes for all using (true) with check (true);
create policy "dev_questions_all" on public.questions for all using (true) with check (true);
create policy "dev_exams_all" on public.exams for all using (true) with check (true);
create policy "dev_exam_sections_all" on public.exam_sections for all using (true) with check (true);
create policy "dev_exam_questions_all" on public.exam_questions for all using (true) with check (true);

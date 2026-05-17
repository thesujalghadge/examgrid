-- Development RLS: permissive policies until institute auth (Phase 5).
-- Replace with institute-scoped policies before production.

alter table public.institutes enable row level security;
alter table public.questions enable row level security;
alter table public.exams enable row level security;
alter table public.exam_sections enable row level security;
alter table public.exam_questions enable row level security;

create policy "dev_institutes_all" on public.institutes for all using (true) with check (true);
create policy "dev_questions_all" on public.questions for all using (true) with check (true);
create policy "dev_exams_all" on public.exams for all using (true) with check (true);
create policy "dev_exam_sections_all" on public.exam_sections for all using (true) with check (true);
create policy "dev_exam_questions_all" on public.exam_questions for all using (true) with check (true);

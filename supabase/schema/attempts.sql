-- ExamGrid: exam attempts (per student, per exam)

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  exam_id uuid not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  version smallint not null default 1,
  lifecycle text not null,
  exam_ends_at timestamptz not null,
  started_at timestamptz not null,
  submitted_at timestamptz,
  current_question_id text,
  current_section_id text,
  answers jsonb not null default '{}'::jsonb,
  visited jsonb not null default '{}'::jsonb,
  marked_for_review jsonb not null default '{}'::jsonb,
  violations jsonb not null default '[]'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, student_id)
);

create index if not exists attempts_exam_id_idx on public.attempts (exam_id);
create index if not exists attempts_student_id_idx on public.attempts (student_id);
create index if not exists attempts_institute_id_idx on public.attempts (institute_id);

comment on table public.attempts is 'In-progress and submitted CBT attempts';

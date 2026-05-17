-- ExamGrid migration 4/7: exams
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  institute_id uuid not null references public.institutes (id) on delete cascade,
  title text not null,
  subtitle text not null default '',
  exam_type text not null check (exam_type in ('JEE_MAIN', 'NEET', 'CET')),
  duration_minutes integer not null check (duration_minutes > 0),
  total_questions integer not null default 0,
  instructions jsonb not null default '[]'::jsonb,
  scheduled_at timestamptz not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exams_institute_id_idx on public.exams (institute_id);
create index if not exists exams_scheduled_at_idx on public.exams (institute_id, scheduled_at desc);
create index if not exists exams_legacy_id_idx on public.exams (legacy_id) where legacy_id is not null;

comment on table public.exams is 'Exam header; sections in exam_sections, questions in exam_questions';

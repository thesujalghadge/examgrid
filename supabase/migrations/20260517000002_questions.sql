-- ExamGrid migration 3/7: questions
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  institute_id uuid not null references public.institutes (id) on delete cascade,
  subject text not null,
  chapter text not null default '',
  topic text not null default '',
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  question_type text not null check (question_type in ('MCQ_SINGLE', 'NUMERICAL')),
  question_text text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  solution text not null default '',
  marks numeric(6, 2) not null default 4,
  negative_marks numeric(6, 2) not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists questions_institute_id_idx on public.questions (institute_id);
create index if not exists questions_subject_idx on public.questions (institute_id, subject);
create index if not exists questions_legacy_id_idx on public.questions (legacy_id) where legacy_id is not null;

comment on table public.questions is 'Reusable question bank entries for exam assembly';

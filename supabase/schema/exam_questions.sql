-- ExamGrid: assembled exam questions (normalized; replaces exams.questions jsonb)

create table if not exists public.exam_questions (
  id text primary key,
  exam_id uuid not null references public.exams (id) on delete cascade,
  section_id text not null,
  institute_id uuid not null references public.institutes (id) on delete cascade,
  question_number integer not null,
  question_type text not null check (question_type in ('MCQ_SINGLE', 'NUMERICAL')),
  question_text text not null,
  options jsonb not null default '[]'::jsonb,
  correct_option_id text,
  correct_numerical_answer text,
  marks numeric(6, 2) not null default 4,
  negative_marks numeric(6, 2) not null default 1,
  bank_question_id uuid references public.questions (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (exam_id, section_id)
    references public.exam_sections (exam_id, id) on delete cascade
);

create index if not exists exam_questions_exam_id_idx on public.exam_questions (exam_id);
create index if not exists exam_questions_section_idx on public.exam_questions (exam_id, section_id);

comment on table public.exam_questions is 'Frozen exam question snapshots for CBT delivery';

-- ExamGrid: server-authoritative CBT attempts, answers, and results.

create table if not exists public.cbt_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  test_id text not null,
  institute_id uuid not null references public.institutes (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  student_roll_number text not null,
  status text not null check (status in ('submitted', 'auto_submitted')),
  started_at timestamptz not null,
  submitted_at timestamptz not null,
  score numeric(10,2) not null default 0,
  accuracy numeric(6,3) not null default 0,
  total_questions integer not null check (total_questions >= 0),
  attempted_questions integer not null check (attempted_questions >= 0),
  integrity_score numeric(6,2) not null default 100,
  flagged boolean not null default false,
  answers jsonb not null default '{}'::jsonb,
  result_breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cbt_attempts_attempted_lte_total
    check (attempted_questions <= total_questions),
  constraint cbt_attempts_unique_student_test
    unique (institute_id, test_id, student_roll_number),
  constraint cbt_attempts_unique_session
    unique (session_id)
);

create table if not exists public.cbt_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.cbt_attempts (id) on delete cascade,
  question_id text not null,
  selected_answer text,
  is_correct boolean not null default false,
  marks_awarded numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint cbt_attempt_answers_unique_question unique (attempt_id, question_id)
);

create table if not exists public.cbt_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.cbt_attempts (id) on delete cascade,
  score numeric(10,2) not null default 0,
  percentage numeric(6,3) not null default 0,
  accuracy numeric(6,3) not null default 0,
  rank_ready boolean not null default false,
  generated_at timestamptz not null default now(),
  constraint cbt_results_unique_attempt unique (attempt_id)
);

create index if not exists cbt_attempts_test_idx
  on public.cbt_attempts (institute_id, test_id);
create index if not exists cbt_attempts_student_idx
  on public.cbt_attempts (student_id);
create index if not exists cbt_attempts_roll_idx
  on public.cbt_attempts (institute_id, student_roll_number);
create index if not exists cbt_attempts_submitted_idx
  on public.cbt_attempts (institute_id, test_id, submitted_at desc);
create index if not exists cbt_attempt_answers_attempt_idx
  on public.cbt_attempt_answers (attempt_id);
create index if not exists cbt_results_attempt_idx
  on public.cbt_results (attempt_id);

-- Academic Intelligence / PYQ pipeline tables (exam-agnostic)

create table if not exists public.intelligence_pyq_sources (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  exam_profile_id text not null,
  file_name text not null,
  mime_type text not null,
  storage_path text not null,
  file_size_bytes bigint not null default 0,
  exam_year int,
  subject_hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.intelligence_pyq_sources (id) on delete cascade,
  institute_id uuid not null references public.institutes (id) on delete cascade,
  exam_profile_id text not null,
  status text not null check (
    status in ('queued', 'processing', 'completed', 'failed', 'cancelled')
  ),
  error_message text,
  raw_text text,
  chunk_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_structured_questions (
  id uuid primary key default gen_random_uuid(),
  extraction_job_id uuid not null references public.intelligence_extraction_jobs (id) on delete cascade,
  source_id uuid not null references public.intelligence_pyq_sources (id) on delete cascade,
  institute_id uuid not null references public.institutes (id) on delete cascade,
  exam_profile_id text not null,
  segment jsonb not null,
  review_status text not null check (
    review_status in ('pending', 'approved', 'rejected', 'needs_edit')
  ) default 'pending',
  review_notes text,
  bank_question_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_ai_solutions (
  id uuid primary key default gen_random_uuid(),
  structured_question_id uuid not null references public.intelligence_structured_questions (id) on delete cascade,
  provider_id text not null,
  model text not null,
  structured jsonb not null,
  raw_response text not null,
  confidence numeric(4, 3) not null default 0,
  review_status text not null check (
    review_status in ('pending', 'approved', 'rejected', 'needs_edit')
  ) default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_verifications (
  id uuid primary key default gen_random_uuid(),
  solution_id uuid not null references public.intelligence_ai_solutions (id) on delete cascade,
  structured_question_id uuid not null references public.intelligence_structured_questions (id) on delete cascade,
  primary_provider_id text not null,
  verifier_provider_id text not null,
  result jsonb not null,
  raw_verifier_response text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_question_metadata (
  id uuid primary key default gen_random_uuid(),
  structured_question_id uuid not null unique references public.intelligence_structured_questions (id) on delete cascade,
  metadata jsonb not null,
  provider_id text not null,
  raw_response text not null,
  confidence numeric(4, 3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_difficulty_signals (
  id uuid primary key default gen_random_uuid(),
  structured_question_id uuid not null unique references public.intelligence_structured_questions (id) on delete cascade,
  signal jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Future: pgvector embeddings for RAG (store as jsonb until extension enabled)
create table if not exists public.intelligence_embeddings (
  id uuid primary key default gen_random_uuid(),
  structured_question_id uuid not null references public.intelligence_structured_questions (id) on delete cascade,
  embedding_model text not null,
  embedding jsonb,
  content_hash text,
  created_at timestamptz not null default now()
);

create index if not exists intelligence_sources_institute_idx
  on public.intelligence_pyq_sources (institute_id, exam_profile_id);

create index if not exists intelligence_structured_review_idx
  on public.intelligence_structured_questions (institute_id, review_status);

comment on table public.intelligence_pyq_sources is 'Uploaded PYQ PDF/DOCX sources';
comment on table public.intelligence_structured_questions is 'Segmented questions pending human review';

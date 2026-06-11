-- Phase 1: Solution Generation & Academic Intelligence Schema

-- Drop the barebones question_solutions table if it exists
DROP TABLE IF EXISTS public.question_solutions CASCADE;

-- 1. Immutable Question Assets
CREATE TABLE IF NOT EXISTS public.question_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('stem', 'option', 'solution')),
  storage_key text NOT NULL,
  url text NOT NULL,
  width integer,
  height integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS question_assets_question_idx ON public.question_assets(question_id);
CREATE INDEX IF NOT EXISTS question_assets_institute_idx ON public.question_assets(institute_id);

-- 2. Structured Question Payload Preservation
CREATE TABLE IF NOT EXISTS public.question_content (
  question_id uuid PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  structured_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text,
  extracted_subject text,
  extracted_chapter text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS question_content_institute_idx ON public.question_content(institute_id);

-- 3. Versioned Solutions & AI Metadata
CREATE TABLE IF NOT EXISTS public.question_solutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT false,
  
  -- Solution Content & Answers
  content_markdown text NOT NULL,
  final_answer text,
  answer_confidence numeric(5,2),
  
  -- Provider Agnosticism & Tracking
  provider text NOT NULL,
  model_name text NOT NULL,
  prompt_version text NOT NULL,
  token_usage jsonb DEFAULT '{}'::jsonb,
  
  -- State & Workflow
  generation_status text NOT NULL DEFAULT 'completed',
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'edited', 'rejected')),
  
  -- Academic Intelligence Metadata
  ai_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  created_by text
);

-- Ensure only one active solution per question
CREATE UNIQUE INDEX IF NOT EXISTS question_solutions_active_question_idx ON public.question_solutions(question_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS question_solutions_institute_idx ON public.question_solutions(institute_id);

-- 4. Solution Generation Queue
CREATE TABLE IF NOT EXISTS public.solution_generation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority integer NOT NULL DEFAULT 10,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  next_retry_at timestamptz DEFAULT now(),
  error_log jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solution_generation_queue_status_retry_idx ON public.solution_generation_queue(status, next_retry_at) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS solution_generation_queue_institute_idx ON public.solution_generation_queue(institute_id);
-- Ensure a question isn't enqueued multiple times concurrently
CREATE UNIQUE INDEX IF NOT EXISTS solution_generation_queue_question_pending_idx ON public.solution_generation_queue(question_id) WHERE status IN ('pending', 'processing');

-- 5. Solution Generation Events (Audit Log)
CREATE TABLE IF NOT EXISTS public.solution_generation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.solution_generation_queue(id) ON DELETE CASCADE,
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('queued', 'processing', 'retry', 'completed', 'failed', 'regenerated')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solution_generation_events_queue_idx ON public.solution_generation_events(queue_id);
CREATE INDEX IF NOT EXISTS solution_generation_events_institute_idx ON public.solution_generation_events(institute_id);

-- 6. Exam Solution Status (Aggregate Table for Monitoring)
CREATE TABLE IF NOT EXISTS public.exam_solution_status (
  exam_id uuid PRIMARY KEY REFERENCES public.exams(id) ON DELETE CASCADE,
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  total_questions integer NOT NULL DEFAULT 0,
  completed_solutions integer NOT NULL DEFAULT 0,
  pending_solutions integer NOT NULL DEFAULT 0,
  failed_solutions integer NOT NULL DEFAULT 0,
  last_updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exam_solution_status_institute_idx ON public.exam_solution_status(institute_id);

-- 7. Add solutions_release_time to exam_schedules
ALTER TABLE public.exam_schedules ADD COLUMN IF NOT EXISTS solutions_release_time timestamptz;

-- 8. Apply RLS to all new tables
alter table public.question_assets enable row level security;
alter table public.question_content enable row level security;
alter table public.question_solutions enable row level security;
alter table public.solution_generation_queue enable row level security;
alter table public.solution_generation_events enable row level security;
alter table public.exam_solution_status enable row level security;

drop policy if exists "dev_question_assets_all" on public.question_assets;
drop policy if exists "dev_question_content_all" on public.question_content;
drop policy if exists "dev_question_solutions_all" on public.question_solutions;
drop policy if exists "dev_solution_generation_queue_all" on public.solution_generation_queue;
drop policy if exists "dev_solution_generation_events_all" on public.solution_generation_events;
drop policy if exists "dev_exam_solution_status_all" on public.exam_solution_status;

create policy "dev_question_assets_all" on public.question_assets for all using (true) with check (true);
create policy "dev_question_content_all" on public.question_content for all using (true) with check (true);
create policy "dev_question_solutions_all" on public.question_solutions for all using (true) with check (true);
create policy "dev_solution_generation_queue_all" on public.solution_generation_queue for all using (true) with check (true);
create policy "dev_solution_generation_events_all" on public.solution_generation_events for all using (true) with check (true);
create policy "dev_exam_solution_status_all" on public.exam_solution_status for all using (true) with check (true);

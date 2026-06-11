-- Phase 2 Solution Pipeline Revision Migration

-- 1. Create test_question_assets (Untouched Phase 1)
CREATE TABLE IF NOT EXISTS public.test_question_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_question_id text NOT NULL,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_number integer NOT NULL,
  image_url text NOT NULL,
  storage_path text,
  asset_source text NOT NULL DEFAULT 'PDF_EXTRACTION',
  extracted_text text,
  solution_status text NOT NULL DEFAULT 'PENDING' CHECK (solution_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS test_question_assets_exam_idx ON public.test_question_assets(exam_id);
CREATE INDEX IF NOT EXISTS test_question_assets_eq_idx ON public.test_question_assets(exam_question_id);
CREATE INDEX IF NOT EXISTS test_question_assets_status_idx ON public.test_question_assets(solution_status);

-- 2. Alter question_solutions
ALTER TABLE public.question_solutions DROP CONSTRAINT IF EXISTS question_solutions_question_id_fkey;

ALTER TABLE public.question_solutions
  ADD COLUMN IF NOT EXISTS test_question_asset_id uuid REFERENCES public.test_question_assets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS chapter text,
  ADD COLUMN IF NOT EXISTS concepts jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS answer_key text,
  ADD COLUMN IF NOT EXISTS generation_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS model_name text,
  ADD COLUMN IF NOT EXISTS prompt_version text,
  ADD COLUMN IF NOT EXISTS generation_duration_ms integer,
  ADD COLUMN IF NOT EXISTS generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

UPDATE public.question_solutions SET generation_status = UPPER(generation_status) WHERE generation_status IN ('pending', 'processing', 'completed', 'failed');
ALTER TABLE public.question_solutions ALTER COLUMN generation_status SET DEFAULT 'PENDING';
ALTER TABLE public.question_solutions DROP CONSTRAINT IF EXISTS question_solutions_generation_status_check;
ALTER TABLE public.question_solutions ADD CONSTRAINT question_solutions_generation_status_check CHECK (generation_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'));

ALTER TABLE public.question_solutions DROP CONSTRAINT IF EXISTS unique_test_question_asset_id;
ALTER TABLE public.question_solutions ADD CONSTRAINT unique_test_question_asset_id UNIQUE (test_question_asset_id);

CREATE INDEX IF NOT EXISTS question_solutions_asset_idx ON public.question_solutions(test_question_asset_id);
CREATE INDEX IF NOT EXISTS question_solutions_status_idx ON public.question_solutions(generation_status);

-- 3. Alter solution_generation_queue
ALTER TABLE public.solution_generation_queue DROP CONSTRAINT IF EXISTS solution_generation_queue_question_id_fkey;

ALTER TABLE public.solution_generation_queue 
  ADD COLUMN IF NOT EXISTS test_question_asset_id uuid REFERENCES public.test_question_assets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS solution_generation_queue_status_idx ON public.solution_generation_queue(status);
CREATE INDEX IF NOT EXISTS solution_generation_queue_created_idx ON public.solution_generation_queue(created_at);

-- 4. Create test_solution_settings
CREATE TABLE IF NOT EXISTS public.test_solution_settings (
  test_id uuid PRIMARY KEY REFERENCES public.exams(id) ON DELETE CASCADE,
  release_mode text NOT NULL DEFAULT 'AFTER_TEST_END' CHECK (release_mode IN ('AFTER_TEST_END', 'MANUAL_RELEASE', 'SCHEDULED_RELEASE')),
  release_datetime timestamptz,
  teacher_released boolean DEFAULT false,
  released_at timestamptz,
  released_by uuid,
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Create solution_generation_logs
CREATE TABLE IF NOT EXISTS public.solution_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_job_id uuid REFERENCES public.solution_generation_queue(id) ON DELETE CASCADE,
  model_name text,
  status text,
  error_message text,
  processing_time_ms integer,
  institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solution_generation_logs_queue_job_idx ON public.solution_generation_logs(queue_job_id);
CREATE INDEX IF NOT EXISTS solution_generation_logs_created_idx ON public.solution_generation_logs(created_at);

-- 6. Apply RLS to all new tables
alter table public.test_question_assets enable row level security;
alter table public.test_solution_settings enable row level security;
alter table public.solution_generation_logs enable row level security;

drop policy if exists "dev_test_question_assets_all" on public.test_question_assets;
drop policy if exists "dev_test_solution_settings_all" on public.test_solution_settings;
drop policy if exists "dev_solution_generation_logs_all" on public.solution_generation_logs;

create policy "dev_test_question_assets_all" on public.test_question_assets for all using (true) with check (true);
create policy "dev_test_solution_settings_all" on public.test_solution_settings for all using (true) with check (true);
create policy "dev_solution_generation_logs_all" on public.solution_generation_logs for all using (true) with check (true);

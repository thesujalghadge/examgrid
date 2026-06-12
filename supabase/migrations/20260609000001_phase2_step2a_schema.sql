-- Phase 2 Step 2A Schema Migration

-- 1. Create generic background_jobs table
CREATE TABLE IF NOT EXISTS public.background_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
    job_type text NOT NULL CHECK (job_type IN ('ASSET_IMPORT', 'CLEANUP')),
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL_SUCCESS', 'FAILED')),
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    job_version integer NOT NULL DEFAULT 1,
    attempts integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz,
    error text
);

CREATE INDEX IF NOT EXISTS background_jobs_status_idx ON public.background_jobs(status);
CREATE INDEX IF NOT EXISTS background_jobs_type_idx ON public.background_jobs(job_type);

-- 2. Alter test_question_assets to add asset_status and metadata
ALTER TABLE public.test_question_assets 
ADD COLUMN IF NOT EXISTS asset_status text NOT NULL DEFAULT 'PENDING_UPLOAD',
ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
ADD COLUMN IF NOT EXISTS uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS upload_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS content_hash text;

ALTER TABLE public.test_question_assets DROP CONSTRAINT IF EXISTS test_question_assets_asset_status_check;
ALTER TABLE public.test_question_assets ADD CONSTRAINT test_question_assets_asset_status_check CHECK (asset_status IN ('PENDING_UPLOAD', 'PROCESSING', 'UPLOADING', 'UPLOADED', 'FAILED', 'SIMULATED'));

-- 3. Add UNIQUE constraint to test_question_assets for idempotency
ALTER TABLE public.test_question_assets DROP CONSTRAINT IF EXISTS unique_exam_question_id;
ALTER TABLE public.test_question_assets ADD CONSTRAINT unique_exam_question_id UNIQUE (exam_question_id);

-- 4. Apply RLS to background_jobs
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev_background_jobs_all" ON public.background_jobs;
CREATE POLICY "dev_background_jobs_all" ON public.background_jobs FOR ALL USING (true) WITH CHECK (true);

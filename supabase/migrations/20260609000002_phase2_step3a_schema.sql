-- Phase 2 Step 3A Schema Migration

-- 1. Add WAITING_RETRY to solution_generation_queue status
ALTER TABLE public.solution_generation_queue DROP CONSTRAINT IF EXISTS solution_generation_queue_status_check;
ALTER TABLE public.solution_generation_queue ADD CONSTRAINT solution_generation_queue_status_check CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'WAITING_RETRY', 'VALIDATION_FAILED'));

-- 2. Add prompt_snapshot and validation_passed to question_solutions
ALTER TABLE public.question_solutions ADD COLUMN IF NOT EXISTS prompt_snapshot text;
ALTER TABLE public.question_solutions ADD COLUMN IF NOT EXISTS validation_passed boolean;

-- 3. Add UNIQUE constraint to enforce queue idempotency
ALTER TABLE public.solution_generation_queue DROP CONSTRAINT IF EXISTS unique_queue_asset_id;
ALTER TABLE public.solution_generation_queue ADD CONSTRAINT unique_queue_asset_id UNIQUE (test_question_asset_id);

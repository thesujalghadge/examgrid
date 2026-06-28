-- Ensure queue timeout tracking columns and statuses exist for the active worker.

ALTER TABLE public.solution_generation_queue
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

ALTER TABLE public.solution_generation_queue
  DROP CONSTRAINT IF EXISTS solution_generation_queue_status_check;

ALTER TABLE public.solution_generation_queue
  ADD CONSTRAINT solution_generation_queue_status_check
  CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','WAITING_RETRY','TIMED_OUT','WAITING_DAILY_BUDGET','VALIDATION_FAILED'));

ALTER TABLE public.solution_generation_queue
ADD COLUMN IF NOT EXISTS failure_stage text,
ADD COLUMN IF NOT EXISTS failure_reason text,
ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE public.solution_generation_queue DROP CONSTRAINT IF EXISTS solution_generation_queue_status_check;
ALTER TABLE public.solution_generation_queue ADD CONSTRAINT solution_generation_queue_status_check CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'WAITING_RETRY'));

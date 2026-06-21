UPDATE public.solution_generation_queue SET status = UPPER(status) WHERE status IN ('pending', 'processing', 'completed', 'failed');
ALTER TABLE public.solution_generation_queue ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE public.solution_generation_queue DROP CONSTRAINT IF EXISTS solution_generation_queue_status_check;
ALTER TABLE public.solution_generation_queue ADD CONSTRAINT solution_generation_queue_status_check CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'));

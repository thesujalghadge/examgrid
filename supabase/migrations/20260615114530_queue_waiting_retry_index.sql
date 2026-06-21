DROP INDEX IF EXISTS public.solution_generation_queue_question_pending_idx;

CREATE UNIQUE INDEX IF NOT EXISTS solution_generation_queue_question_pending_idx 
ON public.solution_generation_queue(question_id) 
WHERE status IN ('PENDING', 'PROCESSING', 'WAITING_RETRY');

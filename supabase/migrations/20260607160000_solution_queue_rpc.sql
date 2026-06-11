-- Phase 2: RPC for Queue Locking

CREATE OR REPLACE FUNCTION public.lease_solution_generation_job()
RETURNS TABLE (
  id uuid,
  question_id uuid,
  institute_id uuid,
  attempts integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  leased_job RECORD;
BEGIN
  UPDATE public.solution_generation_queue
  SET status = 'processing',
      attempts = solution_generation_queue.attempts + 1,
      updated_at = now()
  WHERE solution_generation_queue.id = (
    SELECT q.id
    FROM public.solution_generation_queue q
    WHERE q.status = 'pending' 
      AND q.next_retry_at <= now()
    ORDER BY q.priority DESC, q.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING solution_generation_queue.id, solution_generation_queue.question_id, solution_generation_queue.institute_id, solution_generation_queue.attempts INTO leased_job;

  IF leased_job.id IS NOT NULL THEN
    INSERT INTO public.solution_generation_events (queue_id, institute_id, event_type)
    VALUES (leased_job.id, leased_job.institute_id, 'processing');
  END IF;

  RETURN QUERY SELECT leased_job.id, leased_job.question_id, leased_job.institute_id, leased_job.attempts;
END;
$$;

NOTIFY pgrst, 'reload schema';

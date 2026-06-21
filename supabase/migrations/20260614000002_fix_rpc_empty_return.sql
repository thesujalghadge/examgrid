CREATE OR REPLACE FUNCTION public.lease_solution_generation_job_v2()
RETURNS TABLE (
  id uuid,
  test_question_asset_id uuid,
  institute_id uuid,
  attempts integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  leased_job RECORD;
BEGIN
  UPDATE public.solution_generation_queue
  SET status = 'PROCESSING',
      started_at = now(),
      updated_at = now()
  WHERE solution_generation_queue.id = (
    SELECT q.id
    FROM public.solution_generation_queue q
    WHERE q.status IN ('PENDING', 'WAITING_RETRY', 'VALIDATION_FAILED')
      AND (q.next_retry_at IS NULL OR q.next_retry_at <= now())
      AND q.attempts < 3
    ORDER BY q.priority DESC, q.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING 
    solution_generation_queue.id, 
    solution_generation_queue.test_question_asset_id, 
    solution_generation_queue.institute_id, 
    solution_generation_queue.attempts 
  INTO leased_job;

  IF leased_job.id IS NOT NULL THEN
    INSERT INTO public.solution_generation_events (queue_id, institute_id, event_type)
    VALUES (leased_job.id, leased_job.institute_id, 'processing');
    
    RETURN QUERY SELECT 
      leased_job.id, 
      leased_job.test_question_asset_id, 
      leased_job.institute_id, 
      leased_job.attempts;
  END IF;
END;
$$;

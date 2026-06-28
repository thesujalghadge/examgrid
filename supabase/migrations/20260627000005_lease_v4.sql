CREATE OR REPLACE FUNCTION public.lease_and_charge_job_v4()
RETURNS TABLE (
  id uuid,
  question_id text,
  test_question_asset_id uuid,
  institute_id uuid,
  attempts integer,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
  v_requests_used INTEGER;
BEGIN
  -- Find 1 job
  -- Changed created_at ASC to DESC so newest jobs are processed first
  SELECT q.id, q.question_id, q.test_question_asset_id, q.institute_id, q.attempts, q.charged_requests, q.status
  INTO v_job
  FROM public.solution_generation_queue q
  WHERE q.status IN ('PENDING', 'WAITING_RETRY', 'TIMED_OUT', 'WAITING_DAILY_BUDGET')
    AND (q.next_retry_at IS NULL OR q.next_retry_at <= now())
    AND q.attempts < 5
  ORDER BY q.priority DESC, q.created_at DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job.id IS NULL THEN
    RETURN; -- No jobs
  END IF;

  -- Ensure budget row exists for today
  IF NOT EXISTS (SELECT 1 FROM public.gemini_usage_budget g WHERE g.institute_id = v_job.institute_id AND g.budget_date = CURRENT_DATE) THEN
    INSERT INTO public.gemini_usage_budget (institute_id, budget_date, requests_used, tokens_used)
    VALUES (v_job.institute_id, CURRENT_DATE, 0, 0);
  END IF;

  -- Check budget
  SELECT requests_used INTO v_requests_used
  FROM public.gemini_usage_budget
  WHERE gemini_usage_budget.institute_id = v_job.institute_id AND budget_date = CURRENT_DATE
  FOR UPDATE;

  -- If budget exhausted (>= 480)
  IF v_requests_used >= 480 THEN
    UPDATE public.solution_generation_queue
    SET status = 'WAITING_DAILY_BUDGET',
        updated_at = now()
    WHERE solution_generation_queue.id = v_job.id;
    
    RETURN QUERY SELECT v_job.id, v_job.question_id, v_job.test_question_asset_id, v_job.institute_id, v_job.attempts, 'WAITING_DAILY_BUDGET'::text;
    RETURN;
  END IF;

  -- Budget is safe. Charge missing requests.
  IF v_job.charged_requests < 2 THEN
    UPDATE public.gemini_usage_budget
    SET requests_used = requests_used + (2 - v_job.charged_requests),
        last_updated_at = now()
    WHERE gemini_usage_budget.institute_id = v_job.institute_id AND budget_date = CURRENT_DATE;
  END IF;

  -- Lease job
  UPDATE public.solution_generation_queue
  SET status = 'PROCESSING',
      charged_requests = 2,
      updated_at = now()
  WHERE solution_generation_queue.id = v_job.id;

  RETURN QUERY SELECT v_job.id, v_job.question_id, v_job.test_question_asset_id, v_job.institute_id, v_job.attempts, 'PROCESSING'::text;
END;
$$;

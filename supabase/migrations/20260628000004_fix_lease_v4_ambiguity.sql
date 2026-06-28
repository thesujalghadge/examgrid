-- Qualify lease RPC budget references to avoid PL/pgSQL output-column ambiguity.

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
  v_requests_used integer;
BEGIN
  SELECT q.id, q.question_id, q.test_question_asset_id, q.institute_id, q.attempts, q.charged_requests, q.status
  INTO v_job
  FROM public.solution_generation_queue q
  WHERE q.status IN ('PENDING', 'WAITING_RETRY', 'TIMED_OUT', 'WAITING_DAILY_BUDGET')
    AND (q.next_retry_at IS NULL OR q.next_retry_at <= now())
    AND q.attempts < 5
  ORDER BY q.priority DESC, q.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job.id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.gemini_usage_budget (institute_id, budget_date, requests_used, tokens_used)
  VALUES (v_job.institute_id, CURRENT_DATE, 0, 0)
  ON CONFLICT ON CONSTRAINT gemini_usage_budget_pkey DO NOTHING;

  SELECT b.requests_used INTO v_requests_used
  FROM public.gemini_usage_budget b
  WHERE b.institute_id = v_job.institute_id
    AND b.budget_date = CURRENT_DATE
  FOR UPDATE;

  IF v_requests_used >= 480 THEN
    UPDATE public.solution_generation_queue q
    SET status = 'WAITING_DAILY_BUDGET', updated_at = now()
    WHERE q.id = v_job.id;
    RETURN QUERY SELECT v_job.id, v_job.question_id, v_job.test_question_asset_id, v_job.institute_id, v_job.attempts, 'WAITING_DAILY_BUDGET'::text;
    RETURN;
  END IF;

  IF coalesce(v_job.charged_requests, 0) < 2 THEN
    UPDATE public.gemini_usage_budget b
    SET requests_used = b.requests_used + (2 - coalesce(v_job.charged_requests, 0)),
        last_updated_at = now()
    WHERE b.institute_id = v_job.institute_id
      AND b.budget_date = CURRENT_DATE;
  END IF;

  UPDATE public.solution_generation_queue q
  SET status = 'PROCESSING',
      charged_requests = 2,
      attempts = q.attempts + 1,
      processing_started_at = now(),
      updated_at = now()
  WHERE q.id = v_job.id;

  RETURN QUERY SELECT v_job.id, v_job.question_id, v_job.test_question_asset_id, v_job.institute_id, v_job.attempts, 'PROCESSING'::text;
END;
$$;

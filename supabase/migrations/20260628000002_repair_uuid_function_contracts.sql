-- Repair UUID unification fallout while preserving text question identity.

CREATE OR REPLACE FUNCTION public.upsert_question_analytics_batch(p_analytics_data jsonb)
RETURNS void AS $$
BEGIN
  INSERT INTO public.question_analytics (
    question_id,
    exam_id,
    attempt_count,
    correct_count,
    incorrect_count,
    unattempted_count,
    average_time_seconds,
    accuracy,
    difficulty_index
  )
  SELECT
    item->>'question_id',
    (item->>'exam_id')::uuid,
    (item->>'attempt_count')::integer,
    (item->>'correct_count')::integer,
    (item->>'incorrect_count')::integer,
    (item->>'unattempted_count')::integer,
    (item->>'average_time_seconds')::numeric,
    CASE
      WHEN (item->>'attempt_count')::integer > 0
      THEN ((item->>'correct_count')::numeric / (item->>'attempt_count')::numeric) * 100
      ELSE 0
    END,
    CASE
      WHEN (item->>'attempt_count')::integer > 0
      THEN ((item->>'correct_count')::numeric / (item->>'attempt_count')::numeric)
      ELSE 0
    END
  FROM jsonb_array_elements(p_analytics_data) AS item
  ON CONFLICT (question_id) DO UPDATE SET
    attempt_count = question_analytics.attempt_count + EXCLUDED.attempt_count,
    correct_count = question_analytics.correct_count + EXCLUDED.correct_count,
    incorrect_count = question_analytics.incorrect_count + EXCLUDED.incorrect_count,
    unattempted_count = question_analytics.unattempted_count + EXCLUDED.unattempted_count,
    average_time_seconds = CASE
      WHEN (question_analytics.attempt_count + EXCLUDED.attempt_count) > 0
      THEN ((question_analytics.average_time_seconds * question_analytics.attempt_count) + (EXCLUDED.average_time_seconds * EXCLUDED.attempt_count)) / (question_analytics.attempt_count + EXCLUDED.attempt_count)
      ELSE 0
    END,
    accuracy = CASE
      WHEN (question_analytics.attempt_count + EXCLUDED.attempt_count) > 0
      THEN ((question_analytics.correct_count + EXCLUDED.correct_count)::numeric / (question_analytics.attempt_count + EXCLUDED.attempt_count)) * 100
      ELSE 0
    END,
    difficulty_index = CASE
      WHEN (question_analytics.attempt_count + EXCLUDED.attempt_count) > 0
      THEN ((question_analytics.correct_count + EXCLUDED.correct_count)::numeric / (question_analytics.attempt_count + EXCLUDED.attempt_count))
      ELSE 0
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.submit_cbt_attempt(
  p_session_id text,
  p_test_id uuid,
  p_institute_id uuid,
  p_student_roll_number text,
  p_status text,
  p_started_at timestamptz,
  p_submitted_at timestamptz,
  p_answers jsonb,
  p_result_breakdown jsonb,
  p_integrity_score numeric,
  p_flagged boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.cbt_attempts%rowtype;
  v_result public.cbt_results%rowtype;
  v_student_id uuid;
  v_exam_exists boolean;
  v_total_questions integer;
  v_attempted integer;
  v_correct integer;
  v_score numeric(10,2);
  v_max_score numeric(10,2);
  v_accuracy numeric(6,3);
  v_percentage numeric(6,3);
begin
  if p_status not in ('submitted', 'auto_submitted') then
    raise exception 'Invalid CBT attempt status: %', p_status using errcode = '22023';
  end if;

  select id into v_student_id
  from public.students
  where institute_id = p_institute_id
    and lower(roll_number) = lower(trim(p_student_roll_number))
  limit 1;

  if v_student_id is null then
    raise exception 'Student roll number is not registered for this institute' using errcode = '23503';
  end if;

  select exists (
    select 1
    from public.exams
    where id = p_test_id
      and institute_id = p_institute_id
  ) into v_exam_exists;

  if not v_exam_exists then
    raise exception 'Exam does not exist or does not belong to this institute' using errcode = '23503';
  end if;

  select * into v_attempt
  from public.cbt_attempts
  where institute_id = p_institute_id
    and test_id = p_test_id
    and lower(student_roll_number) = lower(trim(p_student_roll_number))
  for update;

  if found then
    select * into v_result from public.cbt_results where attempt_id = v_attempt.id;
    return jsonb_build_object(
      'attempt', to_jsonb(v_attempt),
      'result', to_jsonb(v_result),
      'answers', coalesce((
        select jsonb_agg(to_jsonb(a) order by a.created_at)
        from public.cbt_attempt_answers a
        where a.attempt_id = v_attempt.id
      ), '[]'::jsonb),
      'idempotent', true
    );
  end if;

  v_total_questions := coalesce((p_result_breakdown->>'correct')::integer, 0)
    + coalesce((p_result_breakdown->>'incorrect')::integer, 0)
    + coalesce((p_result_breakdown->>'unattempted')::integer, 0);
  v_attempted := coalesce((p_result_breakdown->>'attempted')::integer, 0);
  v_correct := coalesce((p_result_breakdown->>'correct')::integer, 0);
  v_score := coalesce((p_result_breakdown->>'finalScore')::numeric, 0);
  v_max_score := coalesce((p_result_breakdown->>'maxScore')::numeric, 0);
  v_accuracy := case when v_attempted > 0 then round((v_correct::numeric / v_attempted::numeric) * 100, 3) else 0 end;
  v_percentage := case when v_max_score > 0 then round((v_score / v_max_score) * 100, 3) else 0 end;

  insert into public.cbt_attempts (
    session_id, test_id, institute_id, student_id, student_roll_number, status,
    started_at, submitted_at, score, accuracy, total_questions, attempted_questions,
    integrity_score, flagged, answers, result_breakdown
  ) values (
    p_session_id, p_test_id, p_institute_id, v_student_id, trim(p_student_roll_number), p_status,
    p_started_at, p_submitted_at, v_score, v_accuracy, v_total_questions, v_attempted,
    coalesce(p_integrity_score, 100), coalesce(p_flagged, false), coalesce(p_answers, '{}'::jsonb), p_result_breakdown
  ) returning * into v_attempt;

  insert into public.cbt_attempt_answers (
    attempt_id, question_id, selected_answer, is_correct, marks_awarded,
    time_taken_seconds, visited_count, answer_changed_count, first_answer, marked_for_review
  )
  select
    v_attempt.id,
    item->>'questionId',
    nullif(item->>'selected', ''),
    coalesce((item->>'correct')::boolean, false),
    coalesce((item->>'marksAwarded')::numeric, 0),
    coalesce((item->>'timeSpentSeconds')::integer, 0),
    coalesce((item->>'visitedCount')::integer, 0),
    coalesce((item->>'answerChangedCount')::integer, 0),
    nullif(item->>'firstAnswer', ''),
    coalesce((item->>'markedForReview')::boolean, false)
  from jsonb_array_elements(coalesce(p_result_breakdown->'perQuestion', '[]'::jsonb)) item
  where item ? 'questionId';

  insert into public.cbt_results (attempt_id, score, percentage, accuracy, rank_ready)
  values (v_attempt.id, v_score, v_percentage, v_accuracy, true)
  returning * into v_result;

  return jsonb_build_object(
    'attempt', to_jsonb(v_attempt),
    'result', to_jsonb(v_result),
    'answers', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at)
      from public.cbt_attempt_answers a
      where a.attempt_id = v_attempt.id
    ), '[]'::jsonb),
    'idempotent', false
  );
end;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_cbt_attempt(text, uuid, uuid, text, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_cbt_attempt(text, uuid, uuid, text, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_cbt_attempt(text, uuid, uuid, text, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean) FROM PUBLIC;

DROP FUNCTION IF EXISTS public.lease_and_charge_job_v4(uuid, uuid);

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
  ON CONFLICT (institute_id, budget_date) DO NOTHING;

  SELECT requests_used INTO v_requests_used
  FROM public.gemini_usage_budget
  WHERE gemini_usage_budget.institute_id = v_job.institute_id
    AND budget_date = CURRENT_DATE
  FOR UPDATE;

  IF v_requests_used >= 480 THEN
    UPDATE public.solution_generation_queue
    SET status = 'WAITING_DAILY_BUDGET', updated_at = now()
    WHERE solution_generation_queue.id = v_job.id;
    RETURN QUERY SELECT v_job.id, v_job.question_id, v_job.test_question_asset_id, v_job.institute_id, v_job.attempts, 'WAITING_DAILY_BUDGET'::text;
    RETURN;
  END IF;

  IF coalesce(v_job.charged_requests, 0) < 2 THEN
    UPDATE public.gemini_usage_budget
    SET requests_used = requests_used + (2 - coalesce(v_job.charged_requests, 0)),
        last_updated_at = now()
    WHERE gemini_usage_budget.institute_id = v_job.institute_id
      AND budget_date = CURRENT_DATE;
  END IF;

  UPDATE public.solution_generation_queue
  SET status = 'PROCESSING',
      charged_requests = 2,
      attempts = attempts + 1,
      processing_started_at = now(),
      updated_at = now()
  WHERE solution_generation_queue.id = v_job.id;

  RETURN QUERY SELECT v_job.id, v_job.question_id, v_job.test_question_asset_id, v_job.institute_id, v_job.attempts, 'PROCESSING'::text;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS question_solutions_question_version_idx
ON public.question_solutions(question_id, version);

DROP FUNCTION IF EXISTS public.commit_solution_and_job(uuid, uuid, uuid, integer, text, text, numeric, text, text, text, jsonb, jsonb, integer);

CREATE OR REPLACE FUNCTION public.commit_solution_and_job(
  p_job_id uuid,
  p_institute_id uuid,
  p_question_id text,
  p_version integer,
  p_content_markdown text,
  p_final_answer text,
  p_answer_confidence numeric,
  p_provider text,
  p_model_name text,
  p_prompt_version text,
  p_token_usage jsonb,
  p_ai_metadata jsonb,
  p_tokens_used integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.question_solutions (
    question_id, institute_id, version, is_active,
    content_markdown, final_answer, answer_confidence,
    provider, model_name, prompt_version, token_usage, ai_metadata
  ) VALUES (
    p_question_id, p_institute_id, p_version, (p_version = 1),
    p_content_markdown, p_final_answer, p_answer_confidence,
    p_provider, p_model_name, p_prompt_version, p_token_usage, p_ai_metadata
  )
  ON CONFLICT (question_id, version) DO UPDATE SET
    content_markdown = EXCLUDED.content_markdown,
    final_answer = EXCLUDED.final_answer,
    answer_confidence = EXCLUDED.answer_confidence,
    provider = EXCLUDED.provider,
    model_name = EXCLUDED.model_name,
    prompt_version = EXCLUDED.prompt_version,
    token_usage = EXCLUDED.token_usage,
    ai_metadata = EXCLUDED.ai_metadata;

  UPDATE public.solution_generation_queue
  SET status = 'COMPLETED', updated_at = now()
  WHERE id = p_job_id;

  UPDATE public.gemini_usage_budget
  SET tokens_used = tokens_used + p_tokens_used,
      last_updated_at = now()
  WHERE institute_id = p_institute_id
    AND budget_date = CURRENT_DATE;
END;
$$;


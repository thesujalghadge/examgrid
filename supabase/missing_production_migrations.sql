-- =================================================================================
-- MISSING PRODUCTION MIGRATIONS (CATCH-UP SCRIPT)
-- Copy and paste this entirely into your Supabase SQL Editor.
-- =================================================================================

-- 1. Create timeout marker function (From 20260623020000_queue_reliability_v2.sql)
CREATE OR REPLACE FUNCTION public.mark_timed_out_jobs(p_timeout_minutes int)
RETURNS int AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE public.solution_generation_queue
  SET 
    status = 'TIMED_OUT',
    updated_at = now()
  WHERE status = 'PROCESSING'
    AND processing_started_at < now() - (p_timeout_minutes || ' minutes')::interval;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Create Global Worker State Table for locks (From 20260623030000_worker_lock.sql)
CREATE TABLE IF NOT EXISTS public.global_worker_state (
  id integer PRIMARY KEY CHECK (id = 1),
  is_running boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  expires_at timestamptz,
  worker_id text
);

-- Ensure the single row exists
INSERT INTO public.global_worker_state (id) VALUES (1) ON CONFLICT DO NOTHING;


-- 3. Lock acquisition with self-healing expiry window
CREATE OR REPLACE FUNCTION public.acquire_worker_lock(p_worker_id text, p_ttl_seconds integer)
RETURNS boolean AS $$
DECLARE
  v_locked boolean;
BEGIN
  -- Try to lock if not running OR if the previous lock expired (Self-Healing)
  UPDATE public.global_worker_state
  SET 
    is_running = true,
    locked_at = now(),
    expires_at = now() + (p_ttl_seconds || ' seconds')::interval,
    worker_id = p_worker_id
  WHERE id = 1 
    AND (is_running = false OR expires_at < now())
  RETURNING true INTO v_locked;

  RETURN COALESCE(v_locked, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Lock extension
CREATE OR REPLACE FUNCTION public.extend_worker_lock(p_worker_id text, p_ttl_seconds integer)
RETURNS boolean AS $$
DECLARE
  v_extended boolean;
BEGIN
  UPDATE public.global_worker_state
  SET 
    expires_at = now() + (p_ttl_seconds || ' seconds')::interval
  WHERE id = 1 
    AND worker_id = p_worker_id
  RETURNING true INTO v_extended;

  RETURN COALESCE(v_extended, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Lock release
CREATE OR REPLACE FUNCTION public.release_worker_lock(p_worker_id text)
RETURNS void AS $$
BEGIN
  UPDATE public.global_worker_state
  SET 
    is_running = false,
    locked_at = null,
    expires_at = null,
    worker_id = null
  WHERE id = 1 
    AND worker_id = p_worker_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Harden submit_cbt_attempt RPC and revoke public access (CBT-2026-001)
create or replace function public.submit_cbt_attempt(
  p_session_id text,
  p_test_id text,
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
    raise exception 'Invalid CBT attempt status: %', p_status
      using errcode = '22023';
  end if;

  -- 1. Validate Student exists in this institute
  select id into v_student_id
  from public.students
  where institute_id = p_institute_id
    and lower(roll_number) = lower(trim(p_student_roll_number))
  limit 1;

  if v_student_id is null then
    raise exception 'Student roll number is not registered for this institute'
      using errcode = '23503';
  end if;

  -- 2. Validate Exam exists and belongs to this institute
  select exists (
    select 1 from public.exams
    where institute_id = p_institute_id
      and (id::text = p_test_id or legacy_id = p_test_id)
  ) into v_exam_exists;

  if not v_exam_exists then
    raise exception 'Exam does not exist or does not belong to this institute'
      using errcode = '23503';
  end if;

  -- 3. Lock attempt row if it exists
  select * into v_attempt
  from public.cbt_attempts
  where institute_id = p_institute_id
    and test_id = p_test_id
    and lower(student_roll_number) = lower(trim(p_student_roll_number))
  for update;

  if found then
    select * into v_result
    from public.cbt_results
    where attempt_id = v_attempt.id;

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
    session_id,
    test_id,
    institute_id,
    student_id,
    student_roll_number,
    status,
    started_at,
    submitted_at,
    score,
    accuracy,
    total_questions,
    attempted_questions,
    integrity_score,
    flagged,
    answers,
    result_breakdown
  ) values (
    p_session_id,
    p_test_id,
    p_institute_id,
    v_student_id,
    trim(p_student_roll_number),
    p_status,
    p_started_at,
    p_submitted_at,
    v_score,
    v_accuracy,
    v_total_questions,
    v_attempted,
    coalesce(p_integrity_score, 100),
    coalesce(p_flagged, false),
    coalesce(p_answers, '{}'::jsonb),
    p_result_breakdown
  )
  returning * into v_attempt;

  insert into public.cbt_attempt_answers (
    attempt_id,
    question_id,
    selected_answer,
    is_correct,
    marks_awarded
  )
  select
    v_attempt.id,
    item->>'questionId',
    nullif(item->>'selected', ''),
    coalesce((item->>'correct')::boolean, false),
    coalesce((item->>'marksAwarded')::numeric, 0)
  from jsonb_array_elements(coalesce(p_result_breakdown->'perQuestion', '[]'::jsonb)) item
  where item ? 'questionId';

  insert into public.cbt_results (
    attempt_id,
    score,
    percentage,
    accuracy,
    rank_ready
  ) values (
    v_attempt.id,
    v_score,
    v_percentage,
    v_accuracy,
    true
  )
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


REVOKE EXECUTE ON FUNCTION public.submit_cbt_attempt(text, text, uuid, text, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_cbt_attempt(text, text, uuid, text, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean) FROM authenticated;

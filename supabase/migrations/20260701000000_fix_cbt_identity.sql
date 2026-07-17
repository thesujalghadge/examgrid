-- STEP 1: Drop old RPCs to recreate them with new signatures
DROP FUNCTION IF EXISTS public.submit_cbt_attempt(text, uuid, uuid, text, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean);
DROP FUNCTION IF EXISTS public.get_cbt_submission(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.submit_cbt_attempt(text, text, uuid, text, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean);
DROP FUNCTION IF EXISTS public.get_cbt_submission(uuid, text, text);

-- STEP 2: Recreate RPCs with p_student_id as uuid
create or replace function public.submit_cbt_attempt(
  p_session_id text,
  p_test_id uuid,
  p_institute_id uuid,
  p_student_id uuid,
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
  v_valid_student_id uuid;
  v_roll_number text;
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

  select id, roll_number into v_valid_student_id, v_roll_number
  from public.students
  where institute_id = p_institute_id
    and id = p_student_id
  limit 1;

  if v_valid_student_id is null then
    raise exception 'Student is not registered for this institute' using errcode = '23503';
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
    and student_id = p_student_id
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
    p_session_id, p_test_id, p_institute_id, v_valid_student_id, coalesce(v_roll_number, ''), p_status,
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

create or replace function public.get_cbt_submission(
  p_institute_id uuid,
  p_test_id uuid,
  p_student_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'attempt', to_jsonb(a),
    'result', to_jsonb(r),
    'answers', coalesce((
      select jsonb_agg(to_jsonb(ans) order by ans.created_at)
      from public.cbt_attempt_answers ans
      where ans.attempt_id = a.id
    ), '[]'::jsonb),
    'idempotent', true
  )
  from public.cbt_attempts a
  join public.cbt_results r on r.attempt_id = a.id
  where a.institute_id = p_institute_id
    and a.test_id = p_test_id
    and a.student_id = p_student_id
  limit 1;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_cbt_attempt(text, uuid, uuid, uuid, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_cbt_attempt(text, uuid, uuid, uuid, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_cbt_attempt(text, uuid, uuid, uuid, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_cbt_submission(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_cbt_submission(uuid, uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_cbt_submission(uuid, uuid, uuid) FROM PUBLIC;

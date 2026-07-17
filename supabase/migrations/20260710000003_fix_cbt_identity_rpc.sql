-- Update the RPC function to handle the new payload (using questionId instead of examQuestionId)
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
  v_total_questions integer;
  v_attempted integer;
  v_correct integer;
  v_score numeric(10,2);
  v_max_score numeric(10,2);
  v_accuracy numeric(6,3);
  v_percentage numeric(6,3);
  
  -- Validation vars
  v_item jsonb;
  v_exam_question_id text;
  v_bank_question_id uuid;
  v_actual_bank_question_id uuid;
begin
  if p_status not in ('submitted', 'auto_submitted') then
    raise exception 'Invalid CBT attempt status: %', p_status
      using errcode = '22023';
  end if;

  select id into v_student_id
  from public.students
  where institute_id = p_institute_id
    and lower(roll_number) = lower(trim(p_student_roll_number))
  limit 1;

  if v_student_id is null then
    raise exception 'Student roll number is not registered for this institute'
      using errcode = '23503';
  end if;

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

  -- Canonical Identity Validation
  -- Ensure that every answer provided with a bank_question_id actually matches
  -- what is in the exam_questions table. This prevents client forging.
  for v_item in select * from jsonb_array_elements(coalesce(p_result_breakdown->'perQuestion', '[]'::jsonb)) loop
    v_exam_question_id := coalesce(v_item->>'questionId', v_item->>'examQuestionId');
    
    if v_item->>'bankQuestionId' is not null then
      v_bank_question_id := (v_item->>'bankQuestionId')::uuid;
      
      select bank_question_id into v_actual_bank_question_id
      from public.exam_questions
      where id = v_exam_question_id;

      if v_actual_bank_question_id is distinct from v_bank_question_id then
        raise exception 'Canonical Identity mismatch. Client bank_question_id % for exam_question_id % does not match database record %.', 
          v_bank_question_id, v_exam_question_id, v_actual_bank_question_id
          using errcode = '22000';
      end if;
    end if;
  end loop;

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
    legacy_client_key,
    question_id,
    bank_question_id,
    selected_answer,
    is_correct,
    marks_awarded
  )
  select
    v_attempt.id,
    item->>'legacyClientKey',
    coalesce(item->>'questionId', item->>'examQuestionId'),
    (item->>'bankQuestionId')::uuid,
    nullif(item->>'selected', ''),
    coalesce((item->>'correct')::boolean, false),
    coalesce((item->>'marksAwarded')::numeric, 0)
  from jsonb_array_elements(coalesce(p_result_breakdown->'perQuestion', '[]'::jsonb)) item
  where (item ? 'examQuestionId' or item ? 'legacyClientKey' or item ? 'questionId');

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

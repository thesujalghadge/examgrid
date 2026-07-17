-- 1. Drop all existing overloaded versions to avoid ambiguity
DROP FUNCTION IF EXISTS public.submit_cbt_attempt(text, text, uuid, text, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean);
DROP FUNCTION IF EXISTS public.submit_cbt_attempt(text, uuid, uuid, uuid, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean);
DROP FUNCTION IF EXISTS public.submit_cbt_attempt(text, text, uuid, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean);

-- 2. Create the unified correct function
CREATE OR REPLACE FUNCTION public.submit_cbt_attempt(
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
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt public.cbt_attempts%rowtype;
  v_result public.cbt_results%rowtype;
  v_roll_number text;
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
BEGIN
  IF p_status NOT IN ('submitted', 'auto_submitted') THEN
    RAISE EXCEPTION 'Invalid CBT attempt status: %', p_status USING ERRCODE = '22023';
  END IF;

  SELECT roll_number INTO v_roll_number
  FROM public.students
  WHERE institute_id = p_institute_id
    AND id = p_student_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student is not registered for this institute' USING ERRCODE = '23503';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.exams
    WHERE id = p_test_id AND institute_id = p_institute_id
  ) THEN
    RAISE EXCEPTION 'Exam does not exist or does not belong to this institute' USING ERRCODE = '23503';
  END IF;

  SELECT * INTO v_attempt
  FROM public.cbt_attempts
  WHERE institute_id = p_institute_id
    AND test_id = p_test_id
    AND student_id = p_student_id
  FOR UPDATE;

  IF FOUND THEN
    SELECT * INTO v_result
    FROM public.cbt_results
    WHERE attempt_id = v_attempt.id;

    RETURN jsonb_build_object(
      'attempt', to_jsonb(v_attempt),
      'result', to_jsonb(v_result),
      'answers', COALESCE((
        SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at)
        FROM public.cbt_attempt_answers a
        WHERE a.attempt_id = v_attempt.id
      ), '[]'::jsonb),
      'idempotent', true
    );
  END IF;

  -- Canonical Identity Validation
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_result_breakdown->'perQuestion', '[]'::jsonb)) LOOP
    v_exam_question_id := COALESCE(v_item->>'questionId', v_item->>'examQuestionId');
    
    IF v_item->>'bankQuestionId' IS NOT NULL THEN
      v_bank_question_id := (v_item->>'bankQuestionId')::uuid;
      
      SELECT bank_question_id INTO v_actual_bank_question_id
      FROM public.exam_questions
      WHERE id = v_exam_question_id;

      IF v_actual_bank_question_id IS DISTINCT FROM v_bank_question_id THEN
        RAISE EXCEPTION 'Canonical Identity mismatch. Client bank_question_id % for exam_question_id % does not match database record %.', 
          v_bank_question_id, v_exam_question_id, v_actual_bank_question_id
          USING ERRCODE = '22000';
      END IF;
    END IF;
  END LOOP;

  v_total_questions := COALESCE((p_result_breakdown->>'correct')::integer, 0)
    + COALESCE((p_result_breakdown->>'incorrect')::integer, 0)
    + COALESCE((p_result_breakdown->>'unattempted')::integer, 0);
  v_attempted := COALESCE((p_result_breakdown->>'attempted')::integer, 0);
  v_correct := COALESCE((p_result_breakdown->>'correct')::integer, 0);
  v_score := COALESCE((p_result_breakdown->>'finalScore')::numeric, 0);
  v_max_score := COALESCE((p_result_breakdown->>'maxScore')::numeric, 0);
  v_accuracy := CASE WHEN v_attempted > 0 THEN ROUND((v_correct::numeric / v_attempted::numeric) * 100, 3) ELSE 0 END;
  v_percentage := CASE WHEN v_max_score > 0 THEN ROUND((v_score / v_max_score) * 100, 3) ELSE 0 END;

  INSERT INTO public.cbt_attempts (
    session_id, test_id, institute_id, student_id, student_roll_number, status,
    started_at, submitted_at, score, accuracy, total_questions, attempted_questions,
    integrity_score, flagged, answers, result_breakdown
  ) VALUES (
    p_session_id, p_test_id, p_institute_id, p_student_id, COALESCE(v_roll_number, ''), p_status,
    p_started_at, p_submitted_at, v_score, v_accuracy, v_total_questions, v_attempted,
    COALESCE(p_integrity_score, 100), COALESCE(p_flagged, false), COALESCE(p_answers, '{}'::jsonb), p_result_breakdown
  ) RETURNING * INTO v_attempt;

  INSERT INTO public.cbt_attempt_answers (
    attempt_id,
    legacy_client_key,
    question_id,
    bank_question_id,
    selected_answer,
    is_correct,
    marks_awarded,
    time_taken_seconds,
    visited_count,
    answer_changed_count,
    first_answer,
    marked_for_review
  )
  SELECT
    v_attempt.id,
    COALESCE(item->>'legacyClientKey', item->>'questionId', item->>'examQuestionId'),
    COALESCE(item->>'questionId', item->>'examQuestionId'),
    (item->>'bankQuestionId')::uuid,
    NULLIF(item->>'selected', ''),
    COALESCE((item->>'correct')::boolean, false),
    COALESCE((item->>'marksAwarded')::numeric, 0),
    COALESCE((item->>'timeSpentSeconds')::integer, 0),
    COALESCE((item->>'visitedCount')::integer, 0),
    COALESCE((item->>'answerChangedCount')::integer, 0),
    NULLIF(item->>'firstAnswer', ''),
    COALESCE((item->>'markedForReview')::boolean, false)
  FROM jsonb_array_elements(COALESCE(p_result_breakdown->'perQuestion', '[]'::jsonb)) item
  WHERE (item ? 'examQuestionId' OR item ? 'legacyClientKey' OR item ? 'questionId');

  INSERT INTO public.cbt_results (
    attempt_id, score, percentage, accuracy, rank_ready
  ) VALUES (
    v_attempt.id, v_score, v_percentage, v_accuracy, true
  ) RETURNING * INTO v_result;

  RETURN jsonb_build_object(
    'attempt', to_jsonb(v_attempt),
    'result', to_jsonb(v_result),
    'answers', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at)
      FROM public.cbt_attempt_answers a
      WHERE a.attempt_id = v_attempt.id
    ), '[]'::jsonb),
    'idempotent', false
  );
END;
$$;

-- 3. Restore permissions exactly as hardened
REVOKE EXECUTE ON FUNCTION public.submit_cbt_attempt(text, uuid, uuid, uuid, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_cbt_attempt(text, uuid, uuid, uuid, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean) FROM anon, authenticated;

-- Ensure service_role can execute (by default they can, but let's be explicit)
GRANT EXECUTE ON FUNCTION public.submit_cbt_attempt(text, uuid, uuid, uuid, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean) TO service_role;

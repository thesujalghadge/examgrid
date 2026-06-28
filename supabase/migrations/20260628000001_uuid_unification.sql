-- 1. DELETE ORPHANS
DELETE FROM exam_schedules WHERE exam_id::text !~* '^[0-9a-f-]{36}$' AND exam_id NOT IN (SELECT legacy_id FROM exams WHERE legacy_id IS NOT NULL);
DELETE FROM analytics_jobs WHERE exam_id::text !~* '^[0-9a-f-]{36}$' AND exam_id NOT IN (SELECT legacy_id FROM exams WHERE legacy_id IS NOT NULL);
DELETE FROM analytics_snapshots WHERE exam_id::text !~* '^[0-9a-f-]{36}$' AND exam_id NOT IN (SELECT legacy_id FROM exams WHERE legacy_id IS NOT NULL);
DELETE FROM student_recommendations WHERE exam_id::text !~* '^[0-9a-f-]{36}$' AND exam_id NOT IN (SELECT legacy_id FROM exams WHERE legacy_id IS NOT NULL);
DELETE FROM question_analytics WHERE exam_id::text !~* '^[0-9a-f-]{36}$' AND exam_id NOT IN (SELECT legacy_id FROM exams WHERE legacy_id IS NOT NULL);
DELETE FROM student_exam_subject_analytics WHERE exam_id::text !~* '^[0-9a-f-]{36}$' AND exam_id NOT IN (SELECT legacy_id FROM exams WHERE legacy_id IS NOT NULL);
DELETE FROM student_exam_chapter_analytics WHERE exam_id::text !~* '^[0-9a-f-]{36}$' AND exam_id NOT IN (SELECT legacy_id FROM exams WHERE legacy_id IS NOT NULL);
DELETE FROM student_exam_concept_analytics WHERE exam_id::text !~* '^[0-9a-f-]{36}$' AND exam_id NOT IN (SELECT legacy_id FROM exams WHERE legacy_id IS NOT NULL);


-- 2. BACKFILL
UPDATE exam_schedules s SET exam_id = e.id::text FROM exams e WHERE s.exam_id = e.legacy_id AND s.exam_id::text !~* '^[0-9a-f-]{36}$';
UPDATE analytics_jobs s SET exam_id = e.id::text FROM exams e WHERE s.exam_id = e.legacy_id AND s.exam_id::text !~* '^[0-9a-f-]{36}$';
UPDATE analytics_snapshots s SET exam_id = e.id::text FROM exams e WHERE s.exam_id = e.legacy_id AND s.exam_id::text !~* '^[0-9a-f-]{36}$';
UPDATE student_recommendations s SET exam_id = e.id::text FROM exams e WHERE s.exam_id = e.legacy_id AND s.exam_id::text !~* '^[0-9a-f-]{36}$';
UPDATE question_analytics s SET exam_id = e.id::text FROM exams e WHERE s.exam_id = e.legacy_id AND s.exam_id::text !~* '^[0-9a-f-]{36}$';
UPDATE student_exam_subject_analytics s SET exam_id = e.id::text FROM exams e WHERE s.exam_id = e.legacy_id AND s.exam_id::text !~* '^[0-9a-f-]{36}$';
UPDATE student_exam_chapter_analytics s SET exam_id = e.id::text FROM exams e WHERE s.exam_id = e.legacy_id AND s.exam_id::text !~* '^[0-9a-f-]{36}$';
UPDATE student_exam_concept_analytics s SET exam_id = e.id::text FROM exams e WHERE s.exam_id = e.legacy_id AND s.exam_id::text !~* '^[0-9a-f-]{36}$';


-- 3. TYPE CONVERSION & 4. CONSTRAINTS
ALTER TABLE exam_schedules ALTER COLUMN exam_id TYPE uuid USING exam_id::uuid;
ALTER TABLE exam_schedules ADD CONSTRAINT fk_es_exam_id FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;

ALTER TABLE analytics_jobs ALTER COLUMN exam_id TYPE uuid USING exam_id::uuid;
ALTER TABLE analytics_jobs ADD CONSTRAINT fk_aj_exam_id FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;

ALTER TABLE analytics_snapshots ALTER COLUMN exam_id TYPE uuid USING exam_id::uuid;
ALTER TABLE analytics_snapshots ADD CONSTRAINT fk_as_exam_id FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;

ALTER TABLE student_recommendations ALTER COLUMN exam_id TYPE uuid USING exam_id::uuid;
ALTER TABLE student_recommendations ADD CONSTRAINT fk_sr_exam_id FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;

ALTER TABLE question_analytics ALTER COLUMN exam_id TYPE uuid USING exam_id::uuid;
ALTER TABLE question_analytics ADD CONSTRAINT fk_qa_exam_id FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;

ALTER TABLE student_exam_subject_analytics ALTER COLUMN exam_id TYPE uuid USING exam_id::uuid;
ALTER TABLE student_exam_subject_analytics ADD CONSTRAINT fk_sesa_exam_id FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;

ALTER TABLE student_exam_chapter_analytics ALTER COLUMN exam_id TYPE uuid USING exam_id::uuid;
ALTER TABLE student_exam_chapter_analytics ADD CONSTRAINT fk_seca_exam_id FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;

ALTER TABLE student_exam_concept_analytics ALTER COLUMN exam_id TYPE uuid USING exam_id::uuid;
ALTER TABLE student_exam_concept_analytics ADD CONSTRAINT fk_seco_exam_id FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;



-- 5. RPC RECREATION
-- Drop old ones
DROP FUNCTION IF EXISTS public.refresh_exam_solution_status(text, uuid);
DROP FUNCTION IF EXISTS public.get_test_telemetry(text);
DROP FUNCTION IF EXISTS public.update_test_telemetry(text, numeric, numeric, numeric, jsonb);
DROP FUNCTION IF EXISTS public.lease_and_charge_job_v4(text, uuid);
DROP FUNCTION IF EXISTS public.commit_solution_and_job(uuid, uuid, text, integer, text, text, numeric, text, text, text, jsonb, jsonb, integer);

-- Create new ones
CREATE OR REPLACE FUNCTION public.refresh_exam_solution_status(
  p_exam_id uuid,
  p_institute_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total int;
  v_completed int;
  v_failed int;
  v_pending int;
  v_processing int;
  v_is_ready boolean;
BEGIN
  SELECT
    count(*) as total,
    count(*) filter (where q.status = 'COMPLETED') as completed,
    count(*) filter (where q.status = 'FAILED' OR q.status = 'TIMED_OUT') as failed,
    count(*) filter (where q.status = 'PENDING') as pending,
    count(*) filter (where q.status = 'PROCESSING') as processing
  INTO
    v_total, v_completed, v_failed, v_pending, v_processing
  FROM public.solution_generation_queue q
  JOIN public.exam_questions eq ON eq.id = q.question_id
  WHERE eq.exam_id = p_exam_id AND q.institute_id = p_institute_id;

  v_is_ready := (v_total > 0 AND (v_completed + v_failed) = v_total);

  INSERT INTO public.exam_solution_status (
    exam_id, institute_id, total_questions, completed, failed, pending, processing, is_ready
  )
  VALUES (
    p_exam_id, p_institute_id, coalesce(v_total,0), coalesce(v_completed,0), coalesce(v_failed,0), coalesce(v_pending,0), coalesce(v_processing,0), coalesce(v_is_ready,false)
  )
  ON CONFLICT (exam_id) DO UPDATE SET
    total_questions = EXCLUDED.total_questions,
    completed = EXCLUDED.completed,
    failed = EXCLUDED.failed,
    pending = EXCLUDED.pending,
    processing = EXCLUDED.processing,
    is_ready = EXCLUDED.is_ready,
    solutions_visible_at = CASE WHEN EXCLUDED.is_ready = true THEN coalesce(exam_solution_status.solutions_visible_at, now()) ELSE null END;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_test_telemetry(
  p_test_id uuid
)
RETURNS TABLE (
  telemetry_data jsonb,
  last_updated timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.telemetry_data,
    t.updated_at
  FROM public.cbt_test_telemetry t
  WHERE t.test_id = p_test_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_test_telemetry(
  p_test_id uuid,
  p_time_spent_seconds numeric,
  p_focus_lost_count numeric,
  p_network_interruptions numeric,
  p_device_info jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.cbt_test_telemetry (
    test_id,
    telemetry_data,
    updated_at
  )
  VALUES (
    p_test_id,
    jsonb_build_object(
      'time_spent_seconds', p_time_spent_seconds,
      'focus_lost_count', p_focus_lost_count,
      'network_interruptions', p_network_interruptions,
      'device_info', p_device_info
    ),
    now()
  )
  ON CONFLICT (test_id) DO UPDATE SET
    telemetry_data = EXCLUDED.telemetry_data,
    updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.lease_and_charge_job_v4(
    p_exam_id UUID,
    p_institute_id UUID
) RETURNS TABLE (
    id UUID,
    question_id UUID,
    test_question_asset_id UUID,
    institute_id UUID,
    attempts INTEGER,
    status TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
  v_budget RECORD;
  v_exam RECORD;
BEGIN
  -- 1. Find the next pending job sequentially for this exam using UUID
  SELECT q.* 
  INTO v_job
  FROM public.solution_generation_queue q
  JOIN public.exam_questions eq ON q.question_id = eq.id
  WHERE eq.exam_id = p_exam_id
    AND q.institute_id = p_institute_id
    AND q.status = 'PENDING'
  ORDER BY eq.order_index ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Verify institute matches
  IF v_job.institute_id != p_institute_id THEN
    RAISE EXCEPTION 'Institute mismatch';
  END IF;

  -- Handle daily budget (same as before)
  INSERT INTO public.institute_daily_budgets (institute_id, budget_date, total_requests, tokens_used)
  VALUES (v_job.institute_id, CURRENT_DATE, 0, 0)
  ON CONFLICT (institute_id, budget_date) DO NOTHING;

  SELECT * INTO v_budget FROM public.institute_daily_budgets 
  WHERE institute_id = v_job.institute_id AND budget_date = CURRENT_DATE 
  FOR UPDATE;

  IF v_budget.total_requests + 2 > 3000 THEN
    RAISE EXCEPTION 'Daily request budget exceeded (3000 requests/day)';
  END IF;

  UPDATE public.institute_daily_budgets 
  SET total_requests = total_requests + 2,
      updated_at = now()
  WHERE institute_id = v_job.institute_id AND budget_date = CURRENT_DATE;

  -- Lease job
  UPDATE public.solution_generation_queue
  SET status = 'PROCESSING',
      charged_requests = 2,
      processing_started_at = now(),
      updated_at = now()
  WHERE solution_generation_queue.id = v_job.id;

  RETURN QUERY SELECT v_job.id, v_job.question_id, v_job.test_question_asset_id, v_job.institute_id, v_job.attempts, 'PROCESSING'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_solution_and_job(
    p_job_id UUID,
    p_institute_id UUID,
    p_question_id UUID,
    p_version INTEGER,
    p_content_markdown TEXT,
    p_final_answer TEXT,
    p_answer_confidence NUMERIC,
    p_provider TEXT,
    p_model_name TEXT,
    p_prompt_version TEXT,
    p_token_usage JSONB,
    p_ai_metadata JSONB,
    p_tokens_used INTEGER
) RETURNS VOID
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
    );

    UPDATE public.solution_generation_queue
    SET status = 'COMPLETED',
        updated_at = now()
    WHERE id = p_job_id;

    UPDATE public.institute_daily_budgets
    SET tokens_used = tokens_used + p_tokens_used,
        updated_at = now()
    WHERE institute_id = p_institute_id AND budget_date = CURRENT_DATE;
END;
$$;

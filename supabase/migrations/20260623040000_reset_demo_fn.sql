-- ============================================================
-- reset_demo_data()
-- SECURITY DEFINER function for clean-room demo data wipe.
--
-- KEEP:  institutes, institute API keys, admin users
-- WIPE:  all operational/demo data (exams, students, batches,
--        attempts, solutions, analytics, queues)
-- RESET: global_worker_state lock
--
-- Usage: SELECT * FROM reset_demo_data();
--        or via: supabase.rpc("reset_demo_data")
-- ============================================================

CREATE OR REPLACE FUNCTION public.reset_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := now();
BEGIN

  -- ── 1. Analytics (deepest leaf tables first) ─────────────────
  TRUNCATE TABLE
    analytics_jobs,
    analytics_snapshots,
    student_recommendations,
    student_exam_subject_analytics,
    student_exam_chapter_analytics,
    student_exam_concept_analytics,
    student_cumulative_subject_analytics,
    student_cumulative_chapter_analytics,
    student_cumulative_concept_analytics,
    question_analytics
  RESTART IDENTITY CASCADE;

  -- ── 2. Solutions & Queue ──────────────────────────────────────
  TRUNCATE TABLE
    solution_generation_events,
    solution_generation_queue,
    question_solutions
  RESTART IDENTITY CASCADE;

  -- ── 3. CBT Attempt data ───────────────────────────────────────
  TRUNCATE TABLE
    cbt_attempt_answers,
    cbt_attempts,
    cbt_results
  RESTART IDENTITY CASCADE;

  -- ── 4. Exam content ───────────────────────────────────────────
  TRUNCATE TABLE
    exam_questions,
    exams
  RESTART IDENTITY CASCADE;

  -- ── 5. Students & Batches ─────────────────────────────────────
  --    (institutes row is intentionally preserved)
  TRUNCATE TABLE
    students,
    batches
  RESTART IDENTITY CASCADE;

  -- ── 6. Reset worker lock ──────────────────────────────────────
  UPDATE public.global_worker_state
  SET
    is_running  = false,
    worker_id   = NULL,
    locked_at   = NULL,
    expires_at  = NULL
  WHERE id = 1;

  RETURN jsonb_build_object(
    'status',     'ok',
    'reset_at',   v_start::text,
    'message',    'Demo data wiped. Institutes and API keys preserved.'
  );

END;
$$;

-- Only service-role may call this.
REVOKE EXECUTE ON FUNCTION public.reset_demo_data() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_demo_data() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.reset_demo_data() TO service_role;

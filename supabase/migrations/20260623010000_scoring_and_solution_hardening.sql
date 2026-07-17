-- ============================================================
-- Migration: scoring_and_solution_hardening
-- 1. UNIQUE constraint on cbt_attempt_answers (attempt_id, question_id)
-- 2. Index for performance
-- 3. exam_solution_status tracking table
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- 1. Prevent duplicate answer rows per attempt
-- ─────────────────────────────────────────────────────────

-- First check if constraint already exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_attempt_question'
      AND conrelid = 'public.cbt_attempt_answers'::regclass
  ) THEN
    ALTER TABLE public.cbt_attempt_answers
      ADD CONSTRAINT unique_attempt_question
      UNIQUE (attempt_id, question_id);
  END IF;
END $$;

-- Supporting index for fast lookups by attempt
CREATE INDEX IF NOT EXISTS idx_cbt_attempt_answers_attempt_question
  ON public.cbt_attempt_answers (attempt_id, question_id);

-- ─────────────────────────────────────────────────────────
-- 2. exam_solution_status — live progress tracking table
--    Updated by the worker as it processes each question.
--    Allows the institute dashboard to show:
--      "62/75 solutions ready (83%)"
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.exam_solution_status (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id             text NOT NULL,
  institute_id        uuid NOT NULL,

  total_questions     integer NOT NULL DEFAULT 0,
  completed           integer NOT NULL DEFAULT 0,
  failed              integer NOT NULL DEFAULT 0,
  pending             integer NOT NULL DEFAULT 0,
  processing          integer NOT NULL DEFAULT 0,

  progress_pct        numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_questions > 0
      THEN round((completed::numeric / total_questions::numeric) * 100, 2)
      ELSE 0
    END
  ) STORED,

  is_ready            boolean NOT NULL DEFAULT false,

  -- Visibility rule: solutions visible when is_ready = true
  -- (set by worker when all questions complete or buffer period passes)
  solutions_visible_at timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT exam_solution_status_exam_institute_unique
    UNIQUE (exam_id, institute_id)
);

-- Row-level security consistent with existing patterns
ALTER TABLE public.exam_solution_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_solution_status"
  ON public.exam_solution_status
  FOR ALL
  USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────
-- 3. Function to refresh exam_solution_status from queue
--    Called by the worker after each job completes.
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.refresh_exam_solution_status(
  p_exam_id text,
  p_institute_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total     integer;
  v_completed integer;
  v_failed    integer;
  v_pending   integer;
  v_processing integer;
  v_is_ready  boolean;
BEGIN
  -- Count questions for this exam
  SELECT count(*) INTO v_total
  FROM exam_questions
  WHERE exam_id IN (
    SELECT id FROM exams WHERE id::text = p_exam_id OR legacy_id = p_exam_id
  );

  -- Count queue statuses
  SELECT
    count(*) FILTER (WHERE sgq.status = 'COMPLETED') AS completed,
    count(*) FILTER (WHERE sgq.status IN ('FAILED'))  AS failed,
    count(*) FILTER (WHERE sgq.status = 'PENDING' OR sgq.status = 'WAITING_RETRY') AS pending,
    count(*) FILTER (WHERE sgq.status = 'PROCESSING') AS processing
  INTO v_completed, v_failed, v_pending, v_processing
  FROM solution_generation_queue sgq
  JOIN exam_questions eq ON eq.id = sgq.question_id
  WHERE eq.exam_id IN (
    SELECT id FROM exams WHERE id::text = p_exam_id OR legacy_id = p_exam_id
  )
    AND sgq.institute_id = p_institute_id;

  v_is_ready := (v_total > 0 AND v_pending = 0 AND v_processing = 0);

  INSERT INTO exam_solution_status (
    exam_id, institute_id,
    total_questions, completed, failed, pending, processing, is_ready,
    solutions_visible_at, updated_at
  ) VALUES (
    p_exam_id, p_institute_id,
    v_total, v_completed, v_failed, v_pending, v_processing, v_is_ready,
    CASE WHEN v_is_ready THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (exam_id, institute_id) DO UPDATE SET
    total_questions   = EXCLUDED.total_questions,
    completed         = EXCLUDED.completed,
    failed            = EXCLUDED.failed,
    pending           = EXCLUDED.pending,
    processing        = EXCLUDED.processing,
    is_ready          = EXCLUDED.is_ready,
    solutions_visible_at = CASE
      WHEN EXCLUDED.is_ready AND exam_solution_status.solutions_visible_at IS NULL
        THEN now()
      ELSE exam_solution_status.solutions_visible_at
    END,
    updated_at        = now();
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 4. Helper view: current status per exam (for dashboard)
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_exam_solution_status AS
SELECT
  ess.*,
  e.title AS exam_title
FROM public.exam_solution_status ess
LEFT JOIN public.exams e
  ON e.id::text = ess.exam_id::text OR e.legacy_id::text = ess.exam_id::text;

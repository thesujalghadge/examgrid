-- =================================================================================
-- MISSING SCHEMA COLUMNS MIGRATION
-- Copy and paste this entirely into your Supabase SQL Editor.
-- This resolves the missing 'processing_started_at' and 'TIMED_OUT' status errors.
-- =================================================================================

-- 1. Add processing_started_at to solution_generation_queue
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'solution_generation_queue'
      AND column_name = 'processing_started_at'
  ) THEN
    ALTER TABLE public.solution_generation_queue
      ADD COLUMN processing_started_at timestamptz;
  END IF;
END $$;

-- 2. Update status CHECK constraint to allow 'TIMED_OUT'
ALTER TABLE public.solution_generation_queue
  DROP CONSTRAINT IF EXISTS solution_generation_queue_status_check;

ALTER TABLE public.solution_generation_queue
  ADD CONSTRAINT solution_generation_queue_status_check
  CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','WAITING_RETRY','TIMED_OUT'));

-- 3. Add Duplicate publish protection constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_queue_exam_question'
      AND conrelid = 'public.solution_generation_queue'::regclass
  ) THEN
    ALTER TABLE public.solution_generation_queue
      ADD CONSTRAINT unique_queue_exam_question
      UNIQUE (institute_id, question_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sgq_institute_question
  ON public.solution_generation_queue (institute_id, question_id);

-- 4. Add missing ETA metrics columns to exam_solution_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'exam_solution_status'
      AND column_name = 'started_at'
  ) THEN
    ALTER TABLE public.exam_solution_status
      ADD COLUMN started_at              timestamptz,
      ADD COLUMN last_completed_at       timestamptz,
      ADD COLUMN average_question_seconds numeric(8,2),
      ADD COLUMN estimated_remaining_seconds integer,
      ADD COLUMN timed_out               integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 5. Update refresh_exam_solution_status() to track ETA metrics
CREATE OR REPLACE FUNCTION public.refresh_exam_solution_status(
  p_exam_id text,
  p_institute_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total                   integer;
  v_completed               integer;
  v_failed                  integer;
  v_pending                 integer;
  v_processing              integer;
  v_timed_out               integer;
  v_is_ready                boolean;
  v_started_at              timestamptz;
  v_last_completed_at       timestamptz;
  v_average_question_secs   numeric;
  v_estimated_remaining     integer;
  v_remaining               integer;
BEGIN
  SELECT count(*) INTO v_total
  FROM exam_questions
  WHERE exam_id IN (SELECT id FROM exams WHERE id::text = p_exam_id OR legacy_id = p_exam_id);

  SELECT
    count(*) FILTER (WHERE sgq.status = 'COMPLETED')                          AS completed,
    count(*) FILTER (WHERE sgq.status IN ('FAILED'))                          AS failed,
    count(*) FILTER (WHERE sgq.status IN ('PENDING', 'WAITING_RETRY'))        AS pending,
    count(*) FILTER (WHERE sgq.status = 'PROCESSING')                         AS processing,
    count(*) FILTER (WHERE sgq.status = 'TIMED_OUT')                         AS timed_out,
    min(sgq.processing_started_at)                                            AS started_at,
    max(sgq.updated_at) FILTER (WHERE sgq.status = 'COMPLETED')              AS last_completed_at
  INTO v_completed, v_failed, v_pending, v_processing, v_timed_out,
       v_started_at, v_last_completed_at
  FROM solution_generation_queue sgq
  JOIN exam_questions eq ON eq.id = sgq.question_id
  WHERE eq.exam_id IN (SELECT id FROM exams WHERE id::text = p_exam_id OR legacy_id = p_exam_id)
    AND sgq.institute_id = p_institute_id;

  SELECT avg(extract(epoch FROM (sgq.updated_at - sgq.processing_started_at)))
  INTO v_average_question_secs
  FROM solution_generation_queue sgq
  JOIN exam_questions eq ON eq.id = sgq.question_id
  WHERE eq.exam_id IN (SELECT id FROM exams WHERE id::text = p_exam_id OR legacy_id = p_exam_id)
    AND sgq.institute_id = p_institute_id
    AND sgq.status = 'COMPLETED'
    AND sgq.processing_started_at IS NOT NULL;

  v_remaining := COALESCE(v_pending, 0) + COALESCE(v_processing, 0);
  IF v_average_question_secs > 0 AND v_remaining > 0 THEN
    v_estimated_remaining := round(v_remaining * v_average_question_secs)::integer;
  ELSE
    v_estimated_remaining := NULL;
  END IF;

  v_is_ready := (v_total > 0 AND v_pending = 0 AND v_processing = 0);

  INSERT INTO exam_solution_status (
    exam_id, institute_id,
    total_questions, completed, failed, pending, processing, timed_out, is_ready,
    solutions_visible_at, started_at, last_completed_at,
    average_question_seconds, estimated_remaining_seconds, updated_at
  ) VALUES (
    p_exam_id, p_institute_id,
    v_total, v_completed, v_failed, v_pending, v_processing, v_timed_out, v_is_ready,
    CASE WHEN v_is_ready THEN now() ELSE NULL END,
    v_started_at, v_last_completed_at,
    v_average_question_secs, v_estimated_remaining,
    now()
  )
  ON CONFLICT (exam_id, institute_id) DO UPDATE SET
    total_questions              = EXCLUDED.total_questions,
    completed                    = EXCLUDED.completed,
    failed                       = EXCLUDED.failed,
    pending                      = EXCLUDED.pending,
    processing                   = EXCLUDED.processing,
    timed_out                    = EXCLUDED.timed_out,
    is_ready                     = EXCLUDED.is_ready,
    solutions_visible_at         = CASE
      WHEN EXCLUDED.is_ready AND exam_solution_status.solutions_visible_at IS NULL
        THEN now()
      ELSE exam_solution_status.solutions_visible_at
    END,
    started_at                   = COALESCE(exam_solution_status.started_at, EXCLUDED.started_at),
    last_completed_at            = EXCLUDED.last_completed_at,
    average_question_seconds     = EXCLUDED.average_question_seconds,
    estimated_remaining_seconds  = EXCLUDED.estimated_remaining_seconds,
    updated_at                   = now();
END;
$$;

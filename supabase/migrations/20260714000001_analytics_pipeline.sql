-- Step 1: effective_question_mappings CQRS View
CREATE OR REPLACE VIEW public.effective_question_mappings AS
SELECT DISTINCT ON (question_id)
    id AS mapping_observation_id,
    question_id,
    subject_id,
    chapter_id,
    topic_id,
    subtopic_id,
    confidence,
    status,
    classification_provider,
    classification_model,
    prompt_version,
    embedding_model,
    created_at
FROM public.question_node_mappings
WHERE is_primary = true AND is_active = true
ORDER BY 
  question_id,
  CASE status 
    WHEN 'VERIFIED' THEN 1
    WHEN 'PENDING_REVIEW' THEN 2
    WHEN 'AI_CLASSIFIED' THEN 3
    ELSE 4
  END ASC,
  created_at DESC;

-- Step 2: attempt_question_ledger
CREATE TABLE IF NOT EXISTS public.attempt_question_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.cbt_attempts(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    exam_question_id TEXT NOT NULL,
    bank_question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
    question_version_id UUID, -- Placeholder if we version questions in the future
    curriculum_version_id UUID, -- Usually derived from exam or attempt context
    subject_id UUID,
    chapter_id UUID,
    topic_id UUID,
    subtopic_id UUID,
    selected_option TEXT,
    correct_option TEXT,
    marks_awarded NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    time_taken_ms INTEGER NOT NULL DEFAULT 0,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    mapping_observation_id UUID, -- Links to the exact mapping row used
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(attempt_id, exam_question_id)
);

CREATE INDEX idx_attempt_ledger_student ON public.attempt_question_ledger(student_id);
CREATE INDEX idx_attempt_ledger_mapping ON public.attempt_question_ledger(mapping_observation_id);
CREATE INDEX idx_attempt_ledger_bank_question ON public.attempt_question_ledger(bank_question_id);

-- Step 3: student_node_statistics Fact Store
CREATE TABLE IF NOT EXISTS public.student_node_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES public.curriculum_nodes(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL, -- 'SUBJECT', 'CHAPTER', 'TOPIC', 'SUBTOPIC'
    total_attempted INTEGER NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    total_time_spent_ms BIGINT NOT NULL DEFAULT 0,
    last_attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(student_id, node_id)
);

CREATE INDEX idx_student_node_stats_node ON public.student_node_statistics(node_id);

-- Step 4: Expand background_jobs for Analytics Pipeline
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.background_jobs'::regclass
    ) LOOP
        -- Drop any check constraints that might conflict
        IF r.conname LIKE '%job_type%' OR r.conname LIKE '%check%' THEN
            BEGIN
                EXECUTE 'ALTER TABLE public.background_jobs DROP CONSTRAINT ' || r.conname;
            EXCEPTION WHEN OTHERS THEN
                -- Ignore
            END;
        END IF;
    END LOOP;
END;
$$;

ALTER TABLE public.background_jobs ADD CONSTRAINT background_jobs_job_type_check 
CHECK (job_type IN ('ASSET_IMPORT', 'CLEANUP', 'ATTEMPT_FINISHED', 'PROJECT_DELTAS', 'MAPPING_CHANGED'));

-- Step 5: RPC for Batch Delta UPSERT
CREATE OR REPLACE FUNCTION public.upsert_student_node_statistics_batch(
    p_deltas jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    delta record;
BEGIN
    FOR delta IN SELECT * FROM jsonb_to_recordset(p_deltas) AS x(
        student_id uuid,
        node_id uuid,
        node_type text,
        attempt_delta int,
        correct_delta int,
        time_delta int
    )
    LOOP
        INSERT INTO public.student_node_statistics (
            student_id,
            node_id,
            node_type,
            total_attempted,
            total_correct,
            total_time_spent_ms
        )
        VALUES (
            delta.student_id,
            delta.node_id,
            delta.node_type,
            GREATEST(0, delta.attempt_delta),
            GREATEST(0, delta.correct_delta),
            GREATEST(0, delta.time_delta)
        )
        ON CONFLICT (student_id, node_id) DO UPDATE SET
            total_attempted = GREATEST(0, public.student_node_statistics.total_attempted + EXCLUDED.total_attempted),
            total_correct = GREATEST(0, public.student_node_statistics.total_correct + EXCLUDED.total_correct),
            total_time_spent_ms = GREATEST(0, public.student_node_statistics.total_time_spent_ms + EXCLUDED.total_time_spent_ms),
            last_attempted_at = now();
    END LOOP;
END;
$$;

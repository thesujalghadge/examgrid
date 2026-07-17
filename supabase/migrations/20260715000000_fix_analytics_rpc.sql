-- Fix Analytics Pipeline RPC & Add Idempotency
-- 1. Create table for exactly-once execution of projector jobs
CREATE TABLE IF NOT EXISTS public.processed_projector_jobs (
    job_id UUID PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Update RPC to handle idempotency and negative deltas
CREATE OR REPLACE FUNCTION public.upsert_student_node_statistics_batch(
    p_job_id UUID,
    p_deltas JSONB
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    delta record;
BEGIN
    -- Idempotency check: if job_id already processed, silently abort transaction
    IF p_job_id IS NOT NULL THEN
        BEGIN
            INSERT INTO public.processed_projector_jobs (job_id) VALUES (p_job_id);
        EXCEPTION WHEN unique_violation THEN
            RETURN; -- Already processed
        END;
    END IF;

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
            
        -- WAIT! The EXCLUDED values are clamped by GREATEST(0, ...).
        -- We must NOT clamp EXCLUDED for updates. We need the original delta to support negative numbers.
        -- But wait, in PostgreSQL, EXCLUDED refers to the row proposed for insertion.
        -- If we clamp the INSERT values, EXCLUDED will always be >= 0.
        -- Instead, we should use the `delta` variables directly!
    END LOOP;
END;
$$;

-- Since the above function definition is flawed for UPDATEs, let's fix the logic completely:
CREATE OR REPLACE FUNCTION public.upsert_student_node_statistics_batch(
    p_job_id UUID,
    p_deltas JSONB
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    delta record;
BEGIN
    -- Idempotency check
    IF p_job_id IS NOT NULL THEN
        BEGIN
            INSERT INTO public.processed_projector_jobs (job_id) VALUES (p_job_id);
        EXCEPTION WHEN unique_violation THEN
            RETURN; -- Already processed
        END;
    END IF;

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
            total_attempted = GREATEST(0, public.student_node_statistics.total_attempted + delta.attempt_delta),
            total_correct = GREATEST(0, public.student_node_statistics.total_correct + delta.correct_delta),
            total_time_spent_ms = GREATEST(0, public.student_node_statistics.total_time_spent_ms + delta.time_delta),
            last_attempted_at = now();
    END LOOP;
END;
$$;

-- Drop the idempotency table since we will rely on background_jobs
DROP TABLE IF EXISTS public.processed_projector_jobs;

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
    -- Idempotency check using background_jobs exactly-once locking semantics
    IF p_job_id IS NOT NULL THEN
        -- If this update returns 0 rows, it means the job is not in PROCESSING state (e.g., already COMPLETED or FAILED or someone else locked it)
        -- We abort the transaction.
        UPDATE public.background_jobs 
        SET status = 'COMPLETED', completed_at = now() 
        WHERE id = p_job_id AND status = 'PROCESSING';

        IF NOT FOUND THEN
            RETURN;
        END IF;
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

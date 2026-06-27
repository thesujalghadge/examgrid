-- Create an RPC to safely batch-upsert question analytics without race conditions

CREATE OR REPLACE FUNCTION public.upsert_question_analytics_batch(p_analytics_data jsonb)
RETURNS void AS $$
BEGIN
  INSERT INTO public.question_analytics (
    question_id,
    exam_id,
    attempt_count,
    correct_count,
    incorrect_count,
    unattempted_count,
    average_time_seconds,
    accuracy,
    difficulty_index
  )
  SELECT
    (item->>'question_id')::text,
    (item->>'exam_id')::text,
    (item->>'attempt_count')::integer,
    (item->>'correct_count')::integer,
    (item->>'incorrect_count')::integer,
    (item->>'unattempted_count')::integer,
    (item->>'average_time_seconds')::numeric,
    -- Calculate accuracy dynamically
    CASE 
      WHEN (item->>'attempt_count')::integer > 0 
      THEN ((item->>'correct_count')::numeric / (item->>'attempt_count')::numeric) * 100 
      ELSE 0 
    END,
    -- Calculate difficulty dynamically
    CASE 
      WHEN (item->>'attempt_count')::integer > 0 
      THEN ((item->>'correct_count')::numeric / (item->>'attempt_count')::numeric) 
      ELSE 0 
    END
  FROM jsonb_array_elements(p_analytics_data) AS item
  ON CONFLICT (question_id) DO UPDATE SET
    attempt_count = question_analytics.attempt_count + EXCLUDED.attempt_count,
    correct_count = question_analytics.correct_count + EXCLUDED.correct_count,
    incorrect_count = question_analytics.incorrect_count + EXCLUDED.incorrect_count,
    unattempted_count = question_analytics.unattempted_count + EXCLUDED.unattempted_count,
    average_time_seconds = CASE 
      WHEN (question_analytics.attempt_count + EXCLUDED.attempt_count) > 0 
      THEN ((question_analytics.average_time_seconds * question_analytics.attempt_count) + (EXCLUDED.average_time_seconds * EXCLUDED.attempt_count)) / (question_analytics.attempt_count + EXCLUDED.attempt_count)
      ELSE 0 
    END,
    accuracy = CASE 
      WHEN (question_analytics.attempt_count + EXCLUDED.attempt_count) > 0 
      THEN ((question_analytics.correct_count + EXCLUDED.correct_count)::numeric / (question_analytics.attempt_count + EXCLUDED.attempt_count)) * 100 
      ELSE 0 
    END,
    difficulty_index = CASE 
      WHEN (question_analytics.attempt_count + EXCLUDED.attempt_count) > 0 
      THEN ((question_analytics.correct_count + EXCLUDED.correct_count)::numeric / (question_analytics.attempt_count + EXCLUDED.attempt_count)) 
      ELSE 0 
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

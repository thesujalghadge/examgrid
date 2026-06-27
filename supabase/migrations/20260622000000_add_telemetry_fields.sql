-- Add per-question telemetry tracking to cbt_attempt_answers

ALTER TABLE cbt_attempt_answers
ADD COLUMN IF NOT EXISTS time_taken_seconds integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_answer text,
ADD COLUMN IF NOT EXISTS answer_changed_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS marked_for_review boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS visited_count integer DEFAULT 0;

-- Optional: Create indices if we ever plan to run heavy analytical queries directly
CREATE INDEX IF NOT EXISTS idx_cbt_attempt_answers_time_taken ON cbt_attempt_answers (time_taken_seconds);

-- Add solutions_release_time to exams
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS solutions_release_time timestamptz;

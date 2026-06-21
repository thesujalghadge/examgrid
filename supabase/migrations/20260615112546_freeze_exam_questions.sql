ALTER TABLE public.exam_questions
ADD COLUMN IF NOT EXISTS published_image_url text,
ADD COLUMN IF NOT EXISTS published_answer_key text,
ADD COLUMN IF NOT EXISTS published_options jsonb,
ADD COLUMN IF NOT EXISTS published_at timestamptz;

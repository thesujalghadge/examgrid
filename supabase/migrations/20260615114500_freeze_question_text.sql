ALTER TABLE public.exam_questions
ADD COLUMN IF NOT EXISTS published_question_text text;

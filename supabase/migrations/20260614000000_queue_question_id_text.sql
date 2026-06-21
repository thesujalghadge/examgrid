ALTER TABLE public.solution_generation_queue ALTER COLUMN question_id TYPE TEXT USING question_id::text;
ALTER TABLE public.question_solutions ALTER COLUMN question_id TYPE TEXT USING question_id::text;

ALTER TABLE public.question_solutions
  DROP CONSTRAINT IF EXISTS question_solutions_question_id_fkey;

ALTER TABLE public.question_solutions
  ALTER COLUMN question_id TYPE TEXT USING question_id::text;

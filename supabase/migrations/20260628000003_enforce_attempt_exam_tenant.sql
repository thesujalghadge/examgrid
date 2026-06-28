-- Enforce cbt_attempt tenant consistency with the referenced exam.

DELETE FROM public.cbt_attempts ca
USING public.exams e
WHERE ca.test_id = e.id
  AND ca.institute_id <> e.institute_id;

CREATE UNIQUE INDEX IF NOT EXISTS exams_id_institute_id_idx
ON public.exams(id, institute_id);

ALTER TABLE public.cbt_attempts
DROP CONSTRAINT IF EXISTS cbt_attempts_test_institute_fkey;

ALTER TABLE public.cbt_attempts
ADD CONSTRAINT cbt_attempts_test_institute_fkey
FOREIGN KEY (test_id, institute_id)
REFERENCES public.exams(id, institute_id)
ON DELETE RESTRICT;

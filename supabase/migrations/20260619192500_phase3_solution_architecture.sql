-- Phase 3 Solution Architecture
ALTER TABLE public.question_solutions
  ADD COLUMN IF NOT EXISTS subchapter text,
  ADD COLUMN IF NOT EXISTS model_answer text,
  ADD COLUMN IF NOT EXISTS teacher_answer text,
  ADD COLUMN IF NOT EXISTS confidence numeric,
  ADD COLUMN IF NOT EXISTS mismatch_reason text;

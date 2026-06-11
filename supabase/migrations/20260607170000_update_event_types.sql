-- Phase 2.6: Update event_type constraint to allow validation events
ALTER TABLE public.solution_generation_events DROP CONSTRAINT IF EXISTS solution_generation_events_event_type_check;

ALTER TABLE public.solution_generation_events ADD CONSTRAINT solution_generation_events_event_type_check CHECK (
  event_type IN ('queued', 'processing', 'retry', 'completed', 'failed', 'regenerated', 'validation_passed', 'validation_failed', 'answer_key_mismatch')
);

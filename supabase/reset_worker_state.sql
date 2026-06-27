-- ============================================================
-- reset_worker_state.sql
-- Standalone SQL snippet — paste into Supabase SQL Editor or
-- run via the TS script. Also embedded inside reset_demo_data().
-- ============================================================

UPDATE public.global_worker_state
SET
  is_running  = false,
  worker_id   = NULL,
  locked_at   = NULL,
  expires_at  = NULL
WHERE id = 1;

-- Drop the temporary dev policies from Phase 1 to enforce default-deny RLS
DROP POLICY IF EXISTS "dev_cbt_sessions_all" ON public.cbt_sessions;
DROP POLICY IF EXISTS "dev_cbt_session_answers_all" ON public.cbt_session_answers;
DROP POLICY IF EXISTS "dev_cbt_operation_log_all" ON public.cbt_operation_log;

-- By dropping these policies, Postgres defaults to DENY ALL for the public/anon roles.
-- This ensures that only the Next.js backend via Service Role can read/write to active session state.

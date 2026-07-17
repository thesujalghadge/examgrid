-- Phase 1: Relational Schema Foundation (CBT Reliability)
-- This migration introduces the schema for tracking active CBT sessions,
-- enabling authoritative server-side state, robust analytics, and cross-device resume.
-- It strictly adheres to the CBT Domain Model architecture.

CREATE TABLE IF NOT EXISTS public.cbt_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  test_id uuid NOT NULL REFERENCES public.exams (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  institute_id uuid NOT NULL REFERENCES public.institutes (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'ABANDONED', 'EXPIRED')),
  started_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  latest_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cbt_sessions_unique_student_test UNIQUE (student_id, test_id)
);

CREATE TABLE IF NOT EXISTS public.cbt_session_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cbt_sessions (id) ON DELETE CASCADE,
  question_id text NOT NULL,
  selected_options text[] NOT NULL DEFAULT '{}',
  visited boolean NOT NULL DEFAULT false,
  marked_for_review boolean NOT NULL DEFAULT false,
  time_spent_ms integer NOT NULL DEFAULT 0,
  last_interaction_at timestamptz NOT NULL DEFAULT now(),
  version_introduced integer NOT NULL DEFAULT 1,
  CONSTRAINT cbt_session_answers_unique_question UNIQUE (session_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.cbt_operation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cbt_sessions (id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('ANSWERED', 'CLEARED', 'MARKED', 'VISITED_QUESTION', 'LOST_FOCUS')),
  question_id text,
  timestamp timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL
);

-- Indexes for querying by student, session, and ensuring fast analytics queries
CREATE INDEX IF NOT EXISTS cbt_sessions_student_idx ON public.cbt_sessions (student_id);
CREATE INDEX IF NOT EXISTS cbt_sessions_institute_test_idx ON public.cbt_sessions (institute_id, test_id);
CREATE INDEX IF NOT EXISTS cbt_session_answers_session_idx ON public.cbt_session_answers (session_id);
CREATE INDEX IF NOT EXISTS cbt_operation_log_session_idx ON public.cbt_operation_log (session_id);

-- Enforce Row Level Security (RLS)
ALTER TABLE public.cbt_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbt_session_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbt_operation_log ENABLE ROW LEVEL SECURITY;

-- Development policies (Removed to enforce strict security)
-- We intentionally do NOT create any public policies for these tables.
-- By enabling RLS without policies, Postgres defaults to DENY ALL.
-- This guarantees that only the Next.js backend (using the Service Role key)
-- can read/write to these tables, eliminating the possibility of client-side tampering.

COMMENT ON TABLE public.cbt_sessions IS 'Tracks in-progress CBT sessions enforcing the server authoritative timer.';
COMMENT ON TABLE public.cbt_session_answers IS 'Granular relational state for each question during an active session.';
COMMENT ON TABLE public.cbt_operation_log IS 'Append-only ledger of actions for replay and cheat detection.';

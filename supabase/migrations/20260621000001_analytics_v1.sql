-- Analytics V1 Migration

-- 1. Extend cbt_results
ALTER TABLE public.cbt_results
ADD COLUMN IF NOT EXISTS rank integer,
ADD COLUMN IF NOT EXISTS percentile numeric(5,2),
ADD COLUMN IF NOT EXISTS total_candidates integer,
ADD COLUMN IF NOT EXISTS correct_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS incorrect_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS unattempted_count integer DEFAULT 0;

-- 2. Create analytics_jobs table
CREATE TABLE IF NOT EXISTS public.analytics_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id uuid NOT NULL REFERENCES public.cbt_attempts(id) ON DELETE CASCADE,
    student_id uuid NOT NULL,
    exam_id text NOT NULL,
    batch_id uuid,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    error_text text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_jobs_status_idx ON public.analytics_jobs(status);
CREATE INDEX IF NOT EXISTS analytics_jobs_exam_idx ON public.analytics_jobs(exam_id);

-- 3. Create analytics_snapshots table
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    exam_id text NOT NULL,
    batch_id uuid,
    snapshot_type text NOT NULL,
    overall_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(student_id, exam_id, snapshot_type)
);

CREATE INDEX IF NOT EXISTS analytics_snapshots_student_exam_idx ON public.analytics_snapshots(student_id, exam_id);

-- 4. Create Relational Tables for Subject, Chapter, Concept Analytics
CREATE TABLE IF NOT EXISTS public.student_subject_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    exam_id text NOT NULL,
    batch_id uuid,
    syllabus_node_id uuid NOT NULL REFERENCES public.batch_syllabus_nodes(id) ON DELETE CASCADE,
    attempted_count integer NOT NULL DEFAULT 0,
    correct_count integer NOT NULL DEFAULT 0,
    incorrect_count integer NOT NULL DEFAULT 0,
    accuracy numeric(5,2) NOT NULL DEFAULT 0,
    marks_awarded numeric NOT NULL DEFAULT 0,
    time_spent_seconds integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(student_id, exam_id, syllabus_node_id)
);

CREATE TABLE IF NOT EXISTS public.student_chapter_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    exam_id text NOT NULL,
    batch_id uuid,
    syllabus_node_id uuid NOT NULL REFERENCES public.batch_syllabus_nodes(id) ON DELETE CASCADE,
    attempted_count integer NOT NULL DEFAULT 0,
    correct_count integer NOT NULL DEFAULT 0,
    incorrect_count integer NOT NULL DEFAULT 0,
    accuracy numeric(5,2) NOT NULL DEFAULT 0,
    marks_awarded numeric NOT NULL DEFAULT 0,
    time_spent_seconds integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(student_id, exam_id, syllabus_node_id)
);

CREATE TABLE IF NOT EXISTS public.student_concept_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    exam_id text NOT NULL,
    batch_id uuid,
    syllabus_node_id uuid NOT NULL REFERENCES public.batch_syllabus_nodes(id) ON DELETE CASCADE,
    attempted_count integer NOT NULL DEFAULT 0,
    correct_count integer NOT NULL DEFAULT 0,
    incorrect_count integer NOT NULL DEFAULT 0,
    accuracy numeric(5,2) NOT NULL DEFAULT 0,
    marks_awarded numeric NOT NULL DEFAULT 0,
    time_spent_seconds integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(student_id, exam_id, syllabus_node_id)
);

-- 5. Create student_recommendations table
CREATE TABLE IF NOT EXISTS public.student_recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    exam_id text NOT NULL,
    batch_id uuid,
    syllabus_node_id uuid REFERENCES public.batch_syllabus_nodes(id) ON DELETE CASCADE,
    recommendation_type text NOT NULL CHECK (recommendation_type IN ('WEAK_CONCEPT', 'TIME_MANAGEMENT', 'NEEDS_REVISION', 'STRONG_CONCEPT')),
    reason_text text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_recommendations_student_exam_idx ON public.student_recommendations(student_id, exam_id);

-- 6. Create question_analytics table
CREATE TABLE IF NOT EXISTS public.question_analytics (
    question_id text PRIMARY KEY REFERENCES public.exam_questions(id) ON DELETE CASCADE,
    exam_id text NOT NULL,
    attempt_count integer NOT NULL DEFAULT 0,
    correct_count integer NOT NULL DEFAULT 0,
    incorrect_count integer NOT NULL DEFAULT 0,
    unattempted_count integer NOT NULL DEFAULT 0,
    accuracy numeric(5,2) NOT NULL DEFAULT 0,
    average_marks numeric(5,2) NOT NULL DEFAULT 0,
    average_time_seconds numeric(8,2) NOT NULL DEFAULT 0,
    difficulty_index numeric(5,2) NOT NULL DEFAULT 0,
    discrimination_index numeric(5,2) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS question_analytics_exam_idx ON public.question_analytics(exam_id);

-- RLS Enablement
ALTER TABLE public.analytics_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subject_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_chapter_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_concept_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_analytics ENABLE ROW LEVEL SECURITY;

-- Dev Policies (Open access for background jobs and UI)
CREATE POLICY "dev_analytics_jobs_all" ON public.analytics_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_analytics_snapshots_all" ON public.analytics_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_student_subject_analytics_all" ON public.student_subject_analytics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_student_chapter_analytics_all" ON public.student_chapter_analytics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_student_concept_analytics_all" ON public.student_concept_analytics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_student_recommendations_all" ON public.student_recommendations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_question_analytics_all" ON public.question_analytics FOR ALL USING (true) WITH CHECK (true);

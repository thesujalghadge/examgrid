-- Cumulative Analytics Migration

-- 1. Rename existing per-exam tables
ALTER TABLE IF EXISTS public.student_subject_analytics RENAME TO student_exam_subject_analytics;
ALTER TABLE IF EXISTS public.student_chapter_analytics RENAME TO student_exam_chapter_analytics;
ALTER TABLE IF EXISTS public.student_concept_analytics RENAME TO student_exam_concept_analytics;

-- 2. Modify student_recommendations to use structured payloads
-- Since we just created this table and it's mostly empty or test data, we can drop the old columns and add new ones, or rebuild the table.
DROP TABLE IF EXISTS public.student_recommendations;

CREATE TABLE public.student_recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    exam_id text NOT NULL,
    batch_id uuid,
    code text NOT NULL, -- e.g. "GOOD_ACCURACY_LOW_ATTEMPTS", "WEAK_CONCEPT"
    payload jsonb NOT NULL DEFAULT '{}'::jsonb, -- e.g. { "subject": "Physics", "chapter": "Electrostatics", "accuracy": 92, "attempts": 2 }
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_recommendations_student_exam_idx ON public.student_recommendations(student_id, exam_id);
ALTER TABLE public.student_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_student_recommendations_all" ON public.student_recommendations FOR ALL USING (true) WITH CHECK (true);


-- 3. Create Cumulative Analytics Tables
CREATE TABLE IF NOT EXISTS public.student_cumulative_subject_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    batch_id uuid,
    syllabus_node_id uuid NOT NULL REFERENCES public.batch_syllabus_nodes(id) ON DELETE CASCADE,
    total_attempted integer NOT NULL DEFAULT 0,
    total_correct integer NOT NULL DEFAULT 0,
    total_incorrect integer NOT NULL DEFAULT 0,
    overall_accuracy numeric(5,2) NOT NULL DEFAULT 0,
    total_time_seconds integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(student_id, syllabus_node_id)
);

CREATE TABLE IF NOT EXISTS public.student_cumulative_chapter_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    batch_id uuid,
    syllabus_node_id uuid NOT NULL REFERENCES public.batch_syllabus_nodes(id) ON DELETE CASCADE,
    total_attempted integer NOT NULL DEFAULT 0,
    total_correct integer NOT NULL DEFAULT 0,
    total_incorrect integer NOT NULL DEFAULT 0,
    overall_accuracy numeric(5,2) NOT NULL DEFAULT 0,
    total_time_seconds integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(student_id, syllabus_node_id)
);

CREATE TABLE IF NOT EXISTS public.student_cumulative_concept_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    batch_id uuid,
    syllabus_node_id uuid NOT NULL REFERENCES public.batch_syllabus_nodes(id) ON DELETE CASCADE,
    total_attempted integer NOT NULL DEFAULT 0,
    total_correct integer NOT NULL DEFAULT 0,
    total_incorrect integer NOT NULL DEFAULT 0,
    overall_accuracy numeric(5,2) NOT NULL DEFAULT 0,
    total_time_seconds integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(student_id, syllabus_node_id)
);

-- RLS Enablement
ALTER TABLE public.student_cumulative_subject_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_cumulative_chapter_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_cumulative_concept_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_cumulative_subject_all" ON public.student_cumulative_subject_analytics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_cumulative_chapter_all" ON public.student_cumulative_chapter_analytics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_cumulative_concept_all" ON public.student_cumulative_concept_analytics FOR ALL USING (true) WITH CHECK (true);


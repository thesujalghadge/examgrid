-- Migration: Institute Course Hierarchy

-- 1. Courses
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
    curriculum_version_id UUID REFERENCES public.curriculum_versions(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_courses_institute_id ON public.courses(institute_id);
CREATE INDEX idx_courses_curriculum_version_id ON public.courses(curriculum_version_id);

-- 2. Academic Sessions
CREATE TABLE IF NOT EXISTS public.academic_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., '2026-2027'
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_academic_sessions_course_id ON public.academic_sessions(course_id);

-- 3. Link Batches to Academic Sessions
-- Add academic_session_id to batches. Allow null temporarily for migration.
ALTER TABLE public.batches
ADD COLUMN IF NOT EXISTS academic_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;

-- Dev Policies (Allow all for Phase 1 dev)
CREATE POLICY "dev_courses_all" ON public.courses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_academic_sessions_all" ON public.academic_sessions FOR ALL USING (true) WITH CHECK (true);

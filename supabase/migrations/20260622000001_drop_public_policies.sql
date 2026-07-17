-- ==============================================================================
-- MIGRATION: Drop Public SELECT Policies & Enforce Application-Layer Security
-- ==============================================================================
-- 
-- ExamGrid uses Custom JWTs via `eg_workspace_session` cookie for authentication.
-- Because of this, the frontend Supabase REST client lacks a valid `Authorization` 
-- Bearer token, rendering `auth.uid()` null for all client-side queries.
-- 
-- The previous RLS policies `USING (true)` left the database open to IDOR attacks.
-- Since we have now migrated all sensitive data fetching to Next.js Server Actions 
-- (which use the Service Role Key after validating the custom Workspace Session), 
-- we can safely DROP the open policies and restrict public access entirely.
-- 
-- Any remaining client-side queries will now correctly receive 401 Unauthorized 
-- or 403 Forbidden, forcing all data access through our secure API layer.
-- ==============================================================================

-- Drop all open "dev" policies on analytics tables
DROP POLICY IF EXISTS "dev_analytics_jobs_all" ON public.analytics_jobs;
DROP POLICY IF EXISTS "dev_analytics_snapshots_all" ON public.analytics_snapshots;
DROP POLICY IF EXISTS "dev_student_subject_analytics_all" ON public.student_exam_subject_analytics;
DROP POLICY IF EXISTS "dev_student_chapter_analytics_all" ON public.student_exam_chapter_analytics;
DROP POLICY IF EXISTS "dev_student_concept_analytics_all" ON public.student_exam_concept_analytics;
DROP POLICY IF EXISTS "dev_student_recommendations_all" ON public.student_recommendations;
DROP POLICY IF EXISTS "dev_cumulative_subject_all" ON public.student_cumulative_subject_analytics;
DROP POLICY IF EXISTS "dev_cumulative_chapter_all" ON public.student_cumulative_chapter_analytics;
DROP POLICY IF EXISTS "dev_cumulative_concept_all" ON public.student_cumulative_concept_analytics;

-- Drop open policies on new V2 tables (if they exist)
DROP POLICY IF EXISTS "dev_student_exam_subject_analytics_all" ON public.student_exam_subject_analytics;
DROP POLICY IF EXISTS "dev_student_exam_chapter_analytics_all" ON public.student_exam_chapter_analytics;
DROP POLICY IF EXISTS "dev_student_exam_concept_analytics_all" ON public.student_exam_concept_analytics;
DROP POLICY IF EXISTS "dev_question_analytics_all" ON public.question_analytics;

-- Drop open policies on syllabus mapping tables
DROP POLICY IF EXISTS "dev_batch_syllabus_nodes_all" ON public.batch_syllabus_nodes;
DROP POLICY IF EXISTS "dev_question_syllabus_mappings_all" ON public.question_syllabus_mappings;
DROP POLICY IF EXISTS "dev_syllabus_mapping_rules_all" ON public.syllabus_mapping_rules;

-- Ensure RLS is still ENABLED on these tables so that without policies, access is DENIED
ALTER TABLE public.analytics_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_exam_subject_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_exam_chapter_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_exam_concept_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_cumulative_subject_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_cumulative_chapter_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_cumulative_concept_analytics ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.student_exam_subject_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_exam_chapter_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_exam_concept_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_analytics ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.batch_syllabus_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_syllabus_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_mapping_rules ENABLE ROW LEVEL SECURITY;

-- Note: No new policies are created because the Service Role Key bypasses RLS automatically.

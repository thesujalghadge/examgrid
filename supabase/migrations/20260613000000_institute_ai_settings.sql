-- Phase 2.2 Security: Institute AI Settings and Audit Trails

-- 1. Create institute_ai_settings
CREATE TABLE IF NOT EXISTS public.institute_ai_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    institute_id uuid NOT NULL UNIQUE REFERENCES public.institutes(id) ON DELETE CASCADE,
    provider text NOT NULL DEFAULT 'gemini',
    encrypted_api_key text,
    model_name text DEFAULT 'gemini-2.5-flash',
    is_active boolean DEFAULT true,
    allow_platform_ai boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- RLS: Only Service Role can access AI settings
ALTER TABLE public.institute_ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service Role full access to ai settings" ON public.institute_ai_settings 
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Audit Trails & Regeneration on question_solutions
ALTER TABLE public.question_solutions 
  ADD COLUMN IF NOT EXISTS generation_source text CHECK (generation_source IN ('INSTITUTE_KEY', 'PLATFORM_KEY')),
  ADD COLUMN IF NOT EXISTS generated_model text DEFAULT 'gemini-2.5-flash',
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS superseded_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS regenerated_from uuid;

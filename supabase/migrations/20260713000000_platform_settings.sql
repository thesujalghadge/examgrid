-- Migration: Platform Settings for AI
-- Stores global platform settings such as the Gemini API Key

CREATE TABLE IF NOT EXISTS public.platform_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    key_name text NOT NULL UNIQUE,
    key_value text,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- RLS: Only Service Role can access platform settings
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service Role full access to platform settings" ON public.platform_settings 
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Insert initial setting key for Gemini API Key if it doesn't exist
INSERT INTO public.platform_settings (key_name, description)
VALUES ('GEMINI_API_KEY', 'Global Gemini API Key for platform-level AI operations (like Syllabus parsing)')
ON CONFLICT (key_name) DO NOTHING;

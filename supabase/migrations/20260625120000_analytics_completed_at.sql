-- Add completed_at to analytics_jobs
ALTER TABLE public.analytics_jobs
ADD COLUMN IF NOT EXISTS completed_at timestamptz;

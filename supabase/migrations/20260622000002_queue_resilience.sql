-- Add resilience columns to analytics_jobs
ALTER TABLE public.analytics_jobs
ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_attempts integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS next_retry_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- Index for queue polling
CREATE INDEX IF NOT EXISTS idx_analytics_jobs_polling 
ON public.analytics_jobs(status, next_retry_at);

-- Index for stuck jobs detection
CREATE INDEX IF NOT EXISTS idx_analytics_jobs_stuck 
ON public.analytics_jobs(status, started_at);

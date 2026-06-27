-- Create a table to hold global state for the single worker guarantee
CREATE TABLE IF NOT EXISTS public.global_worker_state (
  id integer PRIMARY KEY CHECK (id = 1),
  is_running boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  expires_at timestamptz,
  worker_id text
);

-- Ensure the single row exists
INSERT INTO public.global_worker_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- RPC to acquire lock
CREATE OR REPLACE FUNCTION public.acquire_worker_lock(p_worker_id text, p_ttl_seconds integer)
RETURNS boolean AS $$
DECLARE
  v_locked boolean;
BEGIN
  -- Try to lock if not running or expired
  UPDATE public.global_worker_state
  SET 
    is_running = true,
    locked_at = now(),
    expires_at = now() + (p_ttl_seconds || ' seconds')::interval,
    worker_id = p_worker_id
  WHERE id = 1 
    AND (is_running = false OR expires_at < now())
  RETURNING true INTO v_locked;

  RETURN COALESCE(v_locked, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to extend lock
CREATE OR REPLACE FUNCTION public.extend_worker_lock(p_worker_id text, p_ttl_seconds integer)
RETURNS boolean AS $$
DECLARE
  v_extended boolean;
BEGIN
  UPDATE public.global_worker_state
  SET 
    expires_at = now() + (p_ttl_seconds || ' seconds')::interval
  WHERE id = 1 
    AND worker_id = p_worker_id
  RETURNING true INTO v_extended;

  RETURN COALESCE(v_extended, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to release lock
CREATE OR REPLACE FUNCTION public.release_worker_lock(p_worker_id text)
RETURNS void AS $$
BEGIN
  UPDATE public.global_worker_state
  SET 
    is_running = false,
    locked_at = null,
    expires_at = null,
    worker_id = null
  WHERE id = 1 
    AND worker_id = p_worker_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

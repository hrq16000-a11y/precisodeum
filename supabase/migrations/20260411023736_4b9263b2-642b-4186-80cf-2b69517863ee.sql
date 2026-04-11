
-- Add view_count column to jobs
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Create RPC to increment job view count
CREATE OR REPLACE FUNCTION public.increment_job_view(job_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.jobs SET view_count = view_count + 1 WHERE id = job_id;
$$;


ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_type text NOT NULL DEFAULT 'client';

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT '';

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS work_model text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_jobs_status_approval ON public.jobs(status, approval_status);

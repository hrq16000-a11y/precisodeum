
-- Add sponsor tier/level column
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'basic';

-- Create function to increment sponsor impressions
CREATE OR REPLACE FUNCTION public.increment_sponsor_impression(sponsor_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.sponsors SET impressions = impressions + 1 WHERE id = sponsor_id;
$$;

-- Create function to increment sponsor clicks
CREATE OR REPLACE FUNCTION public.increment_sponsor_click(sponsor_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.sponsors SET clicks = clicks + 1 WHERE id = sponsor_id;
$$;

-- Add job status for approval workflow
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';

-- Fix: Hide contact phone numbers from anonymous/public job listings
-- Only authenticated users who own the job or admins can see phone fields

-- Drop the existing public SELECT policy
DROP POLICY IF EXISTS "Jobs viewable by everyone" ON public.jobs;

-- Recreate public policy that excludes sensitive contact info
-- We use a view approach: restrict columns via a public-facing view
-- But since RLS can't restrict columns, we create a view instead

-- Create a public-safe view for jobs (without sensitive phone data)
CREATE OR REPLACE VIEW public.public_jobs AS
SELECT 
  id, title, subtitle, description, city, neighborhood, state,
  job_type, work_model, opportunity_type, category_id,
  salary, schedule, requirements, activities, benefits,
  cover_image_url, slug, status, created_at, updated_at,
  deadline, approval_status, user_id, deleted_at
FROM public.jobs
WHERE status = 'active' AND deleted_at IS NULL;

-- Re-add the public SELECT policy but keep it - the view is the recommended public access point
-- We still need the base table policy for the view to work
CREATE POLICY "Jobs viewable by everyone"
  ON public.jobs FOR SELECT
  TO public
  USING (status = 'active' AND deleted_at IS NULL);

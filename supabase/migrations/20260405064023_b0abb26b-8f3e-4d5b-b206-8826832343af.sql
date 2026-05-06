
-- Add is_public column to site_settings
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- Mark sensitive keys as non-public
UPDATE public.site_settings SET is_public = false WHERE key IN (
  'auto_approve_providers',
  'auto_approve_jobs',
  'auto_approve_reviews'
);

-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Site settings viewable by everyone" ON public.site_settings;

-- Create restricted public read policy
CREATE POLICY "Public site settings viewable by everyone"
  ON public.site_settings FOR SELECT TO public
  USING (is_public = true);

-- Admins can view all settings
DROP POLICY IF EXISTS "Admins can view all site settings" ON public.site_settings;
CREATE POLICY "Admins can view all site settings"
  ON public.site_settings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

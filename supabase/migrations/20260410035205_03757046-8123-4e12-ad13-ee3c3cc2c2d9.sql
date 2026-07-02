
-- Performance index for ranking queries
CREATE INDEX IF NOT EXISTS idx_providers_counts
ON public.providers (portfolio_photo_count, services_count, portfolio_album_count);

-- Fix overly permissive INSERT policy on provider_impressions
DROP POLICY IF EXISTS "Authenticated can insert impressions" ON public.provider_impressions;
CREATE POLICY "Authenticated can insert impressions"
ON public.provider_impressions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.providers WHERE id = provider_id AND status = 'approved')
);

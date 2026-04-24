CREATE TABLE public.auth_profile_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  succeeded BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_auth_profile_metrics_recorded ON public.auth_profile_metrics (recorded_at DESC);
CREATE INDEX idx_auth_profile_metrics_succeeded ON public.auth_profile_metrics (succeeded, recorded_at DESC);

ALTER TABLE public.auth_profile_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log auth profile metrics"
ON public.auth_profile_metrics
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Only admins can view auth profile metrics"
ON public.auth_profile_metrics
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

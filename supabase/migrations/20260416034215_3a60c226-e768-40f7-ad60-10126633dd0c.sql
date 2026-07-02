
-- Fix storage: remove duplicate/overlapping SELECT policies
DROP POLICY IF EXISTS "Avatars public read by path" ON storage.objects;
DROP POLICY IF EXISTS "Public read all public buckets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view portfolio" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view service images" ON storage.objects;
DROP POLICY IF EXISTS "Public read sponsors" ON storage.objects;
DROP POLICY IF EXISTS "Block non-admin sponsor access" ON storage.objects;

-- Single consolidated read policy for all public buckets
CREATE POLICY "Public read individual files"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('avatars', 'service-images', 'portfolio', 'sponsors')
  AND (storage.filename(name)) IS NOT NULL
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL,
  identifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limits_lookup ON public.rate_limits (action_key, identifier, created_at DESC);

-- Auto-cleanup old entries (keep 24h)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _action text, _identifier text, _max_attempts int, _window_minutes int
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  -- Cleanup old entries
  DELETE FROM rate_limits
  WHERE action_key = _action AND identifier = _identifier
    AND created_at < now() - interval '24 hours';
  
  -- Count recent attempts
  SELECT COUNT(*) INTO v_count
  FROM rate_limits
  WHERE action_key = _action
    AND identifier = _identifier
    AND created_at > now() - (_window_minutes || ' minutes')::interval;
  
  IF v_count >= _max_attempts THEN
    RETURN false;
  END IF;
  
  -- Log this attempt
  INSERT INTO rate_limits (action_key, identifier) VALUES (_action, _identifier);
  RETURN true;
END;
$$;

-- RLS on rate_limits (no direct access)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

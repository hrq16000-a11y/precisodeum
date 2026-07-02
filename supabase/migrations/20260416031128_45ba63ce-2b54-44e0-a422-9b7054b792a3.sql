
-- 1. Blur placeholder column
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS blur_data_url text;

-- 2. Storage quota column on account_types
ALTER TABLE public.account_types ADD COLUMN IF NOT EXISTS storage_limit_mb integer NOT NULL DEFAULT 100;

-- 3. RPC: get user storage usage in MB
CREATE OR REPLACE FUNCTION public.get_user_storage_usage(_user_ref text)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ROUND(SUM(COALESCE(size_optimized, size_original, 0))::numeric / (1024 * 1024), 2),
    0
  )
  FROM media
  WHERE user_ref = _user_ref AND is_active = true;
$$;

-- 4. Function to find orphan media (no matching profile/provider)
CREATE OR REPLACE FUNCTION public.find_orphan_media(_min_age_hours integer DEFAULT 24)
RETURNS TABLE(id uuid, storage_path text, public_url text, user_ref text, created_at timestamptz, size_bytes bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.storage_path, m.public_url, m.user_ref, m.created_at,
         COALESCE(m.size_optimized, m.size_original, 0)::bigint AS size_bytes
  FROM media m
  WHERE m.is_active = true
    AND m.created_at < now() - (_min_age_hours || ' hours')::interval
    AND m.user_ref NOT IN ('unlinked', 'sponsors', 'settings')
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_ref = m.user_ref);
$$;

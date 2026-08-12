CREATE OR REPLACE FUNCTION public.media_owner_is_public(_user_ref text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_ref IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.user_ref = _user_ref AND p.status IN ('approved', 'active')
    )
    OR (
      NOT EXISTS (SELECT 1 FROM public.providers p2 WHERE p2.user_ref = _user_ref)
      AND EXISTS (
        SELECT 1 FROM public.profiles pf
        WHERE pf.user_ref = _user_ref
          AND COALESCE(pf.status, 'active') = 'active'
          AND pf.banned_at IS NULL
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.media_owner_is_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.media_owner_is_public(text) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Public can view active public media" ON public.media;
CREATE POLICY "Public can view active public media"
ON public.media
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND entity_type = ANY (ARRAY['service'::text, 'portfolio'::text, 'profile'::text])
  AND public.media_owner_is_public(user_ref)
);

REVOKE SELECT (tax_id, tax_id_encrypted) ON public.profiles FROM anon, authenticated;
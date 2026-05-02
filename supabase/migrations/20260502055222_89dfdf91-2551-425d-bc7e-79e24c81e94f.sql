CREATE OR REPLACE FUNCTION public.check_registration_block(_email text DEFAULT NULL, _whatsapp text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(_email, '')));
  v_wa text := regexp_replace(coalesce(_whatsapp, ''), '\D', '', 'g');
  v_block public.registration_blocks%ROWTYPE;
BEGIN
  IF v_email = '' AND v_wa = '' THEN
    RETURN jsonb_build_object('blocked', false);
  END IF;

  SELECT * INTO v_block
  FROM public.registration_blocks
  WHERE (
    (v_email <> '' AND lower(coalesce(email, '')) = v_email)
    OR (v_wa <> '' AND regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = v_wa)
  )
  AND (is_permanent = true OR (expires_at IS NOT NULL AND expires_at > now()))
  AND coalesce(reason, '') NOT LIKE '%[expired]%'
  ORDER BY blocked_at DESC
  LIMIT 1;

  IF v_block.id IS NULL THEN
    RETURN jsonb_build_object('blocked', false);
  END IF;

  RETURN jsonb_build_object(
    'blocked', true,
    'reason', coalesce(v_block.reason, 'policy_violation'),
    'permanent', v_block.is_permanent,
    'days_remaining',
      CASE
        WHEN v_block.is_permanent THEN NULL
        WHEN v_block.expires_at IS NOT NULL THEN GREATEST(0, ceil(extract(epoch FROM (v_block.expires_at - now())) / 86400))::int
        ELSE NULL
      END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_registration_block(text, text) TO anon, authenticated;
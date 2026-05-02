-- Estende check_registration_block para aceitar device_fingerprint
CREATE OR REPLACE FUNCTION public.check_registration_block(
  _email text DEFAULT NULL::text,
  _whatsapp text DEFAULT NULL::text,
  _device_fingerprint text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_email text := lower(trim(coalesce(_email, '')));
  v_wa text := regexp_replace(coalesce(_whatsapp, ''), '\D', '', 'g');
  v_fp text := trim(coalesce(_device_fingerprint, ''));
  v_block public.registration_blocks%ROWTYPE;
  v_matched_via text := 'unknown';
BEGIN
  IF v_email = '' AND v_wa = '' AND v_fp = '' THEN
    RETURN jsonb_build_object('blocked', false);
  END IF;

  SELECT * INTO v_block
  FROM public.registration_blocks
  WHERE (
    (v_email <> '' AND lower(coalesce(email, '')) = v_email)
    OR (v_wa <> '' AND regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = v_wa)
    OR (v_fp <> '' AND coalesce(device_fingerprint, '') = v_fp)
  )
  AND (is_permanent = true OR (expires_at IS NOT NULL AND expires_at > now()))
  AND coalesce(reason, '') NOT LIKE '%[expired]%'
  ORDER BY blocked_at DESC
  LIMIT 1;

  IF v_block.id IS NULL THEN
    RETURN jsonb_build_object('blocked', false);
  END IF;

  IF v_email <> '' AND lower(coalesce(v_block.email, '')) = v_email THEN
    v_matched_via := 'email';
  ELSIF v_wa <> '' AND regexp_replace(coalesce(v_block.whatsapp, ''), '\D', '', 'g') = v_wa THEN
    v_matched_via := 'whatsapp';
  ELSIF v_fp <> '' AND coalesce(v_block.device_fingerprint, '') = v_fp THEN
    v_matched_via := 'device';
  END IF;

  RETURN jsonb_build_object(
    'blocked', true,
    'reason', coalesce(v_block.reason, 'policy_violation'),
    'matched_via', v_matched_via,
    'permanent', v_block.is_permanent,
    'expires_at', v_block.expires_at,
    'blocked_at', v_block.blocked_at,
    'days_remaining',
      CASE
        WHEN v_block.is_permanent THEN NULL
        WHEN v_block.expires_at IS NOT NULL THEN GREATEST(0, ceil(extract(epoch FROM (v_block.expires_at - now())) / 86400))::int
        ELSE NULL
      END
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.check_registration_block(text, text, text) TO anon, authenticated;
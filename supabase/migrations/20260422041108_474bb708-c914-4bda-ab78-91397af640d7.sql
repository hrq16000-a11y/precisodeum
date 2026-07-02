CREATE OR REPLACE FUNCTION public.log_provider_public_event(
  provider_id uuid,
  event_action text,
  page_path text DEFAULT NULL::text,
  service_name text DEFAULT NULL::text,
  source_marker text DEFAULT NULL::text,
  cta_origin text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner_id uuid;
  _source text;
  _cta_origin text;
BEGIN
  IF event_action NOT IN ('profile_view', 'whatsapp_click', 'phone_click') THEN
    RAISE EXCEPTION 'invalid event action';
  END IF;

  SELECT p.user_id INTO _owner_id
  FROM public.providers p
  WHERE p.id = provider_id
    AND p.status = 'approved'
    AND p.deleted_at IS NULL;

  IF _owner_id IS NULL THEN
    RETURN;
  END IF;

  _source := lower(coalesce(nullif(source_marker, ''), 'direto'));
  IF _source NOT IN ('direto', 'busca', 'categoria') THEN
    _source := 'direto';
  END IF;

  _cta_origin := lower(coalesce(nullif(cta_origin, ''), 'principal'));
  IF _cta_origin NOT IN ('principal', 'sticky', 'flutuante', 'servico') THEN
    _cta_origin := 'principal';
  END IF;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    _owner_id,
    event_action,
    'provider',
    provider_id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'page_path', page_path,
      'source', _source,
      'cta_origin', _cta_origin,
      'service_name', nullif(service_name, ''),
      'visitor_authenticated', auth.uid() IS NOT NULL
    ))
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.log_provider_public_event(uuid, text, text, text, text, text) TO anon, authenticated;
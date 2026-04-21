-- 1) Função get_smart_ads — respeita status='active' e segmentação geo
CREATE OR REPLACE FUNCTION public.get_smart_ads(
  _location_key text,
  _visitor_city text DEFAULT '',
  _visitor_state text DEFAULT ''
)
RETURNS TABLE (
  id uuid,
  title text,
  image_url text,
  link_url text,
  company_name text,
  priority integer,
  user_ref text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH slot AS (
    SELECT s.id, s.max_ads
    FROM public.ad_slots s
    WHERE s.slug = _location_key AND s.active = true
    LIMIT 1
  )
  SELECT
    sp.id,
    sp.title,
    COALESCE(sp.image_url, sp.logo_url) AS image_url,
    COALESCE(sp.link_url, sp.external_link) AS link_url,
    sp.company_name,
    COALESCE(a.priority, 0) AS priority,
    sp.user_ref
  FROM public.ad_slot_assignments a
  JOIN slot ON slot.id = a.slot_id
  JOIN public.sponsors sp ON sp.id = a.sponsor_id
  WHERE a.active = true
    AND sp.active = true
    AND COALESCE(sp.status, 'active') = 'active'
    AND (a.start_date IS NULL OR a.start_date <= CURRENT_DATE)
    AND (a.end_date   IS NULL OR a.end_date   >= CURRENT_DATE)
    AND (sp.start_date IS NULL OR sp.start_date <= CURRENT_DATE)
    AND (sp.end_date   IS NULL OR sp.end_date   >= CURRENT_DATE)
    AND (a.target_city  IS NULL OR a.target_city  = '' OR _visitor_city  = '' OR a.target_city  = _visitor_city)
    AND (a.target_state IS NULL OR a.target_state = '' OR _visitor_state = '' OR a.target_state = _visitor_state)
  ORDER BY COALESCE(a.priority, 0) DESC, sp.display_order ASC
  LIMIT (SELECT max_ads FROM slot);
$$;

GRANT EXECUTE ON FUNCTION public.get_smart_ads(text, text, text) TO anon, authenticated;

-- 2) track_sponsor_metric agora também grava user_ref no audit_log para portabilidade
CREATE OR REPLACE FUNCTION public.track_sponsor_metric(
  _sponsor_id uuid,
  _slot_slug text,
  _event_type text,
  _page_path text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_ref text;
BEGIN
  INSERT INTO public.sponsor_metrics (sponsor_id, slot_slug, event_type, page_path, event_date, count)
  VALUES (_sponsor_id, _slot_slug, _event_type, _page_path, CURRENT_DATE, 1)
  ON CONFLICT DO NOTHING;

  IF _event_type = 'impression' THEN
    UPDATE public.sponsors SET impressions = impressions + 1 WHERE id = _sponsor_id;
    UPDATE public.sponsors
       SET delivered_impressions = delivered_impressions + 1
     WHERE id = _sponsor_id AND plan = 'pro';
  ELSIF _event_type = 'click' THEN
    UPDATE public.sponsors SET clicks = clicks + 1 WHERE id = _sponsor_id;
  END IF;

  -- Captura user_ref do sponsor para portabilidade do log
  SELECT user_ref INTO v_user_ref FROM public.sponsors WHERE id = _sponsor_id;

  -- Auditoria leve apenas para clicks (impressions são alto-volume)
  IF _event_type = 'click' AND v_user_ref IS NOT NULL THEN
    INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'sponsor_ad_click',
      'sponsor',
      _sponsor_id,
      jsonb_build_object(
        'slot_slug', _slot_slug,
        'page_path', _page_path,
        'sponsor_user_ref', v_user_ref
      )
    );
  END IF;
END;
$function$;
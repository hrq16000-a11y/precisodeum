
-- 1) leads.closed_at
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- 2) mark_lead_as_concluded
CREATE OR REPLACE FUNCTION public.mark_lead_as_concluded(_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_owner_user uuid;
  v_already_closed boolean;
BEGIN
  SELECT l.provider_id, p.user_id, (l.status = 'concluded')
    INTO v_provider_id, v_owner_user, v_already_closed
  FROM public.leads l
  JOIN public.providers p ON p.id = l.provider_id
  WHERE l.id = _lead_id;

  IF v_provider_id IS NULL THEN
    RETURN jsonb_build_object('status','not_found');
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> v_owner_user THEN
    RETURN jsonb_build_object('status','forbidden');
  END IF;

  IF v_already_closed THEN
    RETURN jsonb_build_object('status','already_concluded');
  END IF;

  UPDATE public.leads
     SET status = 'concluded',
         closed_at = now(),
         last_status_at = now()
   WHERE id = _lead_id;

  -- +20 pontos uma única vez por lead concluído
  INSERT INTO public.engagement_log (user_id, action_key, points_awarded, metadata)
  SELECT v_owner_user, 'lead_concluded', 20,
         jsonb_build_object('lead_id', _lead_id, 'provider_id', v_provider_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.engagement_log
    WHERE user_id = v_owner_user
      AND action_key = 'lead_concluded'
      AND metadata->>'lead_id' = _lead_id::text
  );

  RETURN jsonb_build_object('status','concluded','points_awarded',20);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_lead_as_concluded(uuid) TO authenticated;

-- 3) get_review_short_link
CREATE OR REPLACE FUNCTION public.get_review_short_link(_provider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_name text;
  v_user_id uuid;
BEGIN
  SELECT slug, business_name, user_id
    INTO v_slug, v_name, v_user_id
  FROM public.providers
  WHERE id = _provider_id;

  IF v_slug IS NULL THEN
    RETURN jsonb_build_object('status','not_found');
  END IF;

  RETURN jsonb_build_object(
    'status','ok',
    'provider_id', _provider_id,
    'slug', v_slug,
    'name', v_name,
    'review_path', '/profissional/' || v_slug || '?action=review'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_review_short_link(uuid) TO authenticated, anon;

-- 4) get_search_demand_stats — top 5 cidades/bairros nas buscas dos últimos 30d
CREATE OR REPLACE FUNCTION public.get_search_demand_stats(_provider_id uuid)
RETURNS TABLE(
  location_label text,
  city text,
  neighborhood text,
  search_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_category_id uuid;
  v_owner uuid;
BEGIN
  SELECT category_id, user_id INTO v_category_id, v_owner
  FROM public.providers WHERE id = _provider_id;

  IF v_category_id IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> v_owner THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(NULLIF(TRIM(BOTH ' ' FROM
      COALESCE(a.details->>'neighborhood','') ||
      CASE WHEN COALESCE(a.details->>'neighborhood','') <> '' AND COALESCE(a.details->>'city','') <> '' THEN ' - ' ELSE '' END ||
      COALESCE(a.details->>'city','')
    ), ''), 'Sem localização') AS location_label,
    a.details->>'city' AS city,
    a.details->>'neighborhood' AS neighborhood,
    COUNT(*) AS search_count
  FROM public.audit_log a
  WHERE a.action = 'search'
    AND a.created_at >= now() - interval '30 days'
    AND (
      a.details->>'category_id' = v_category_id::text
      OR a.details->>'category_slug' IN (
        SELECT slug FROM public.categories WHERE id = v_category_id
      )
    )
  GROUP BY 1,2,3
  ORDER BY search_count DESC
  LIMIT 5;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_search_demand_stats(uuid) TO authenticated;

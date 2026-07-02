
DROP FUNCTION IF EXISTS public.nearby_providers(double precision, double precision, integer, text, integer, uuid[]);

CREATE OR REPLACE FUNCTION public.nearby_providers(
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL,
  _radius_m integer DEFAULT 50000,
  _category_slug text DEFAULT NULL,
  _limit integer DEFAULT 50,
  _online_user_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  business_name text,
  category_name text,
  category_slug text,
  category_icon text,
  city text,
  state text,
  neighborhood text,
  latitude double precision,
  longitude double precision,
  rating_avg numeric,
  review_count integer,
  photo_url text,
  description text,
  phone text,
  whatsapp text,
  years_experience integer,
  plan text,
  slug text,
  featured boolean,
  services_count integer,
  portfolio_album_count integer,
  portfolio_photo_count integer,
  distance_m double precision,
  is_online boolean,
  visibility_score double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      p.id,
      p.user_id,
      COALESCE(p.business_name, pr.full_name, 'Profissional') AS business_name,
      c.name AS category_name,
      c.slug AS category_slug,
      c.icon AS category_icon,
      p.city, p.state, p.neighborhood,
      p.latitude, p.longitude,
      COALESCE(p.rating_avg, 0)::numeric AS rating_avg,
      COALESCE(p.review_count, 0)::integer AS review_count,
      COALESCE(p.photo_url, pr.avatar_url, '') AS photo_url,
      COALESCE(p.description, '') AS description,
      COALESCE(p.phone, '') AS phone,
      COALESCE(p.whatsapp, p.phone, '') AS whatsapp,
      COALESCE(p.years_experience, 0)::integer AS years_experience,
      COALESCE(p.plan, 'free') AS plan,
      COALESCE(p.slug, p.id::text) AS slug,
      COALESCE(p.featured, false) AS featured,
      COALESCE(p.services_count, 0)::integer AS services_count,
      COALESCE(p.portfolio_album_count, 0)::integer AS portfolio_album_count,
      COALESCE(p.portfolio_photo_count, 0)::integer AS portfolio_photo_count,
      COALESCE(pr.engagement_points, 0)::integer AS engagement_points,
      p.updated_at,
      CASE
        WHEN _lat IS NULL OR _lng IS NULL OR p.latitude IS NULL OR p.longitude IS NULL
          THEN NULL::double precision
        ELSE 111320 * sqrt(
          power(p.latitude - _lat, 2) +
          power((p.longitude - _lng) * cos(radians(_lat)), 2)
        )
      END AS distance_m,
      CASE
        WHEN _online_user_ids IS NULL THEN false
        ELSE p.user_id = ANY(_online_user_ids)
      END AS is_online
    FROM public.providers p
    LEFT JOIN public.profiles pr ON pr.id = p.user_id
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.status = 'approved'
      AND p.deleted_at IS NULL
      AND (_category_slug IS NULL OR c.slug = _category_slug)
  ),
  scored AS (
    SELECT
      b.*,
      CASE
        WHEN b.distance_m IS NULL THEN 0.0
        WHEN b.distance_m <= 0 THEN 1.0
        WHEN b.distance_m >= _radius_m THEN 0.0
        ELSE GREATEST(0.0, LEAST(1.0, 1.0 - (b.distance_m / NULLIF(_radius_m, 0))))
      END AS distance_norm
    FROM base b
  ),
  final AS (
    SELECT
      s.*,
      ROUND((
        (CASE WHEN s.is_online THEN 0.55 ELSE 0.0 END) +
        (s.distance_norm * 0.25) +
        (LEAST(s.engagement_points, 1000)::double precision / 1000.0 * 0.10) +
        (LEAST(s.rating_avg, 5)::double precision / 5.0 * 0.10)
      )::numeric, 4)::double precision AS visibility_score,
      CASE
        WHEN s.is_online AND s.featured THEN 0
        WHEN s.is_online THEN 1
        WHEN s.featured THEN 2
        ELSE 3
      END AS level_priority
    FROM scored s
  )
  SELECT
    id, user_id, business_name, category_name, category_slug, category_icon,
    city, state, neighborhood, latitude, longitude,
    rating_avg, review_count, photo_url, description, phone, whatsapp,
    years_experience, plan, slug, featured,
    services_count, portfolio_album_count, portfolio_photo_count,
    distance_m, is_online, visibility_score
  FROM final
  WHERE
    (_lat IS NULL OR _lng IS NULL OR distance_m IS NULL OR distance_m <= _radius_m)
  ORDER BY
    level_priority ASC,
    visibility_score DESC NULLS LAST,
    engagement_points DESC NULLS LAST,
    rating_avg DESC NULLS LAST,
    review_count DESC NULLS LAST,
    distance_m ASC NULLS LAST,
    updated_at DESC NULLS LAST,
    user_id ASC
  LIMIT GREATEST(1, _limit);
$$;

GRANT EXECUTE ON FUNCTION public.nearby_providers(double precision, double precision, integer, text, integer, uuid[]) TO anon, authenticated;

-- =====================================================================
-- complete_first_contact_mission
-- =====================================================================
CREATE OR REPLACE FUNCTION public.complete_first_contact_mission(_provider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_existing jsonb;
  v_already boolean;
BEGIN
  SELECT user_id, COALESCE(mission_answers, '{}'::jsonb)
    INTO v_user_id, v_existing
  FROM public.providers
  WHERE id = _provider_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> v_user_id THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  v_already := v_existing ? 'first_contact'
               AND v_existing->'first_contact' IS NOT NULL
               AND v_existing->>'first_contact' <> 'null';

  IF v_already THEN
    RETURN jsonb_build_object('status', 'already_completed');
  END IF;

  UPDATE public.providers
     SET mission_answers = COALESCE(mission_answers, '{}'::jsonb)
                            || jsonb_build_object('first_contact', true),
         updated_at = now()
   WHERE id = _provider_id;

  RETURN jsonb_build_object('status', 'completed', 'mission_key', 'first_contact');
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_first_contact_mission(uuid) TO authenticated;

-- =====================================================================
-- admin_conversion_metrics
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_conversion_metrics(
  _tier text DEFAULT NULL,
  _category_slug text DEFAULT NULL,
  _days integer DEFAULT 30
)
RETURNS TABLE (
  tier text,
  category_slug text,
  category_name text,
  providers_count bigint,
  total_visits bigint,
  total_dismisses bigint,
  total_leads bigint,
  total_whatsapp_clicks bigint,
  total_views bigint,
  conversion_rate numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH provs AS (
    SELECT
      p.id,
      p.user_id,
      COALESCE(c.slug, 'sem-categoria')::text AS cat_slug,
      COALESCE(c.name, 'Sem categoria')::text AS cat_name,
      COALESCE((public.get_user_maturity_tier(p.user_id))->>'tier', 'novato')::text AS m_tier
    FROM public.providers p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.status = 'approved' AND p.deleted_at IS NULL
  ),
  filtered AS (
    SELECT * FROM provs
    WHERE (_tier IS NULL OR m_tier = _tier)
      AND (_category_slug IS NULL OR cat_slug = _category_slug)
  ),
  visits AS (
    SELECT uds.user_id,
           COALESCE(uds.visits_count, 0)::bigint AS v,
           COALESCE(array_length(uds.dismissed_widgets, 1), 0)::bigint AS d
    FROM public.user_dashboard_state uds
  ),
  leads_agg AS (
    SELECT l.provider_id, COUNT(*)::bigint AS lead_count
    FROM public.leads l
    WHERE l.created_at >= now() - (_days || ' days')::interval
    GROUP BY l.provider_id
  ),
  clicks_agg AS (
    SELECT cc.provider_id,
           COUNT(*) FILTER (WHERE cc.contact_type = 'whatsapp')::bigint AS w_clicks
    FROM public.contact_clicks cc
    WHERE cc.created_at >= now() - (_days || ' days')::interval
    GROUP BY cc.provider_id
  ),
  views_agg AS (
    SELECT (al.details->>'provider_id')::uuid AS provider_id,
           COUNT(*)::bigint AS views
    FROM public.audit_log al
    WHERE al.action = 'profile_view'
      AND al.created_at >= now() - (_days || ' days')::interval
      AND (al.details->>'provider_id') IS NOT NULL
    GROUP BY (al.details->>'provider_id')::uuid
  )
  SELECT
    f.m_tier AS tier,
    f.cat_slug AS category_slug,
    f.cat_name AS category_name,
    COUNT(DISTINCT f.id)::bigint AS providers_count,
    COALESCE(SUM(v.v), 0)::bigint AS total_visits,
    COALESCE(SUM(v.d), 0)::bigint AS total_dismisses,
    COALESCE(SUM(la.lead_count), 0)::bigint AS total_leads,
    COALESCE(SUM(ca.w_clicks), 0)::bigint AS total_whatsapp_clicks,
    COALESCE(SUM(va.views), 0)::bigint AS total_views,
    CASE
      WHEN COALESCE(SUM(va.views), 0) = 0 THEN 0
      ELSE ROUND((COALESCE(SUM(la.lead_count), 0)::numeric
                  / NULLIF(SUM(va.views), 0)::numeric) * 100, 2)
    END AS conversion_rate
  FROM filtered f
  LEFT JOIN visits v ON v.user_id = f.user_id
  LEFT JOIN leads_agg la ON la.provider_id = f.id
  LEFT JOIN clicks_agg ca ON ca.provider_id = f.id
  LEFT JOIN views_agg va ON va.provider_id = f.id
  GROUP BY f.m_tier, f.cat_slug, f.cat_name
  ORDER BY total_leads DESC, total_visits DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_conversion_metrics(text, text, integer) TO authenticated;

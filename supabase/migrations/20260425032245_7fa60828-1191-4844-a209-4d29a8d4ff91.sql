-- ============================================================
-- LOTE 1: Motor de Visibilidade
-- - providers.mission_answers (jsonb) para Cards de Missão
-- - nearby_providers refatorado: Score = Geo×0.7 + Online×0.3,
--   desempate por engagement_points, NULL-safe
-- - get_contact_impact_24h: contador de visualizações últimas 24h
-- ============================================================

-- 1. Coluna jsonb para respostas de Missões
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS mission_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.providers.mission_answers IS
  'Respostas das missões do dashboard evolutivo. Ex: {"emits_invoice": true, "serves_companies": "yes", "tools_owned": ["furadeira"]}';

CREATE INDEX IF NOT EXISTS idx_providers_mission_answers_gin
  ON public.providers USING gin (mission_answers);

-- 2. Refatorar nearby_providers com Online Boost
--    _online_user_ids: array de user_ids online vindos do Presence (client-side)
--    Score = (1 - distance_norm) * 0.7 + is_online * 0.3
--    Desempate: engagement_points DESC
--    NULL-safe: providers sem geog ainda aparecem se _radius_m for null
CREATE OR REPLACE FUNCTION public.nearby_providers(
  _lat double precision,
  _lng double precision,
  _radius_m integer DEFAULT 50000,
  _category_slug text DEFAULT NULL,
  _limit integer DEFAULT 50,
  _online_user_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid, slug text, business_name text,
  category_name text, category_slug text, category_icon text,
  city text, state text, neighborhood text,
  latitude numeric, longitude numeric,
  distance_m double precision,
  rating_avg numeric, review_count integer, photo_url text,
  plan text, featured boolean, user_id uuid,
  phone text, whatsapp text, description text,
  years_experience integer, services_count integer,
  portfolio_album_count integer, portfolio_photo_count integer,
  is_online boolean,
  visibility_score double precision
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  ref_point geography;
  has_gps boolean;
BEGIN
  has_gps := _lat IS NOT NULL AND _lng IS NOT NULL
             AND _lat BETWEEN -90 AND 90 AND _lng BETWEEN -180 AND 180;

  IF has_gps THEN
    ref_point := ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography;
  ELSE
    ref_point := NULL;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      p.id, p.slug, p.business_name,
      c.name AS cat_name, c.slug AS cat_slug, c.icon AS cat_icon,
      p.city, p.state, p.neighborhood,
      p.latitude, p.longitude,
      CASE
        WHEN has_gps AND p.geog IS NOT NULL
          THEN ST_Distance(p.geog, ref_point)
        ELSE 0::double precision
      END AS dist_m,
      p.rating_avg, p.review_count, p.photo_url,
      p.plan, p.featured, p.user_id,
      p.phone, p.whatsapp, p.description,
      p.years_experience, p.services_count,
      p.portfolio_album_count, p.portfolio_photo_count,
      COALESCE(_online_user_ids @> ARRAY[p.user_id], false) AS online_flag,
      COALESCE(pr.engagement_points, 0) AS eng_points,
      COALESCE(gl.priority, 0) AS lvl_priority
    FROM providers p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN profiles pr ON pr.id = p.user_id
    LEFT JOIN gamification_levels gl ON gl.id = pr.level_id
    WHERE p.status = 'approved'
      AND p.deleted_at IS NULL
      AND (_category_slug IS NULL OR c.slug = _category_slug)
      AND (
        NOT has_gps
        OR (p.geog IS NOT NULL AND ST_DWithin(p.geog, ref_point, _radius_m))
      )
  ),
  scored AS (
    SELECT
      b.*,
      -- Distance normalized (0..1, where 0=closest). When no GPS, all=0.
      CASE
        WHEN NOT has_gps THEN 0::double precision
        ELSE LEAST(1.0, b.dist_m / NULLIF(_radius_m, 0)::double precision)
      END AS dist_norm
    FROM base b
  )
  SELECT
    s.id, s.slug, s.business_name,
    s.cat_name, s.cat_slug, s.cat_icon,
    s.city, s.state, s.neighborhood,
    s.latitude, s.longitude, s.dist_m,
    s.rating_avg, s.review_count, s.photo_url,
    s.plan, s.featured, s.user_id,
    s.phone, s.whatsapp, s.description,
    s.years_experience, s.services_count,
    s.portfolio_album_count, s.portfolio_photo_count,
    s.online_flag AS is_online,
    -- Score = Geo×0.7 + Online×0.3 (when no GPS, geo collapses to 0 → online dominates)
    ((1.0 - s.dist_norm) * 0.7 + (CASE WHEN s.online_flag THEN 1.0 ELSE 0.0 END) * 0.3)
      AS visibility_score
  FROM scored s
  ORDER BY
    s.lvl_priority DESC,
    s.featured DESC,
    visibility_score DESC,
    s.eng_points DESC,           -- desempate
    s.dist_m ASC
  LIMIT _limit;
END;
$function$;

-- 3. Contador de Impacto Real (visualizações de contato últimas 24h)
CREATE OR REPLACE FUNCTION public.get_contact_impact_24h(_user_id uuid)
RETURNS TABLE(
  total_views bigint,
  whatsapp_clicks bigint,
  phone_clicks bigint,
  unique_visitors bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COUNT(*)::bigint AS total_views,
    COUNT(*) FILTER (WHERE contact_type = 'whatsapp')::bigint AS whatsapp_clicks,
    COUNT(*) FILTER (WHERE contact_type = 'phone')::bigint AS phone_clicks,
    COUNT(DISTINCT visitor_id)::bigint AS unique_visitors
  FROM public.contact_clicks cc
  JOIN public.providers p ON p.id = cc.provider_id
  WHERE p.user_id = _user_id
    AND cc.created_at >= now() - interval '24 hours';
$$;

GRANT EXECUTE ON FUNCTION public.get_contact_impact_24h(uuid) TO authenticated;
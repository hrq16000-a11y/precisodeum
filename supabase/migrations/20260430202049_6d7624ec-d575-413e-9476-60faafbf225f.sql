
-- ============================================================
-- 1) ÍNDICES PARCIAIS ADICIONAIS
-- ============================================================
-- Featured + approved (home / destaques)
CREATE INDEX IF NOT EXISTS idx_providers_approved_featured
  ON public.providers (featured, rating_avg DESC NULLS LAST, review_count DESC NULLS LAST)
  WHERE status = 'approved' AND deleted_at IS NULL AND featured = true;

-- Approved + category (busca por categoria)
CREATE INDEX IF NOT EXISTS idx_providers_approved_category
  ON public.providers (category_id, rating_avg DESC NULLS LAST)
  WHERE status = 'approved' AND deleted_at IS NULL;

-- Approved + last_active (ranking por atividade)
CREATE INDEX IF NOT EXISTS idx_providers_approved_last_active
  ON public.providers (last_active_at DESC NULLS LAST)
  WHERE status = 'approved' AND deleted_at IS NULL;

-- Services aprovados por provider (já existe idx_services_category_active; complementar)
CREATE INDEX IF NOT EXISTS idx_services_active_provider
  ON public.services (provider_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- 2) NEARBY_PROVIDERS REESCRITO COM KNN (geog <-> ref_point)
-- ============================================================
DROP FUNCTION IF EXISTS public.nearby_providers(double precision, double precision, integer, text, integer, uuid[], text);

CREATE FUNCTION public.nearby_providers(
  _lat double precision DEFAULT NULL::double precision,
  _lng double precision DEFAULT NULL::double precision,
  _radius_m integer DEFAULT 50000,
  _category_slug text DEFAULT NULL::text,
  _limit integer DEFAULT 50,
  _online_user_ids uuid[] DEFAULT NULL::uuid[],
  _account_type text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid, user_id uuid, business_name text, category_name text, category_slug text, category_icon text,
  city text, state text, neighborhood text, latitude double precision, longitude double precision,
  rating_avg numeric, review_count integer, photo_url text, description text, phone text, whatsapp text,
  years_experience integer, plan text, slug text, featured boolean,
  services_count integer, portfolio_album_count integer, portfolio_photo_count integer,
  distance_m double precision, is_online boolean, visibility_score double precision, activity_signal text,
  account_type text, business_segment text,
  street text, street_number text, complement text, postal_code text, social_links jsonb,
  show_full_address boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
  WITH ref AS (
    SELECT
      CASE WHEN _lat IS NOT NULL AND _lng IS NOT NULL
           THEN ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography
           ELSE NULL::geography END AS pt
  ),
  -- KNN: usa o índice GIST parcial idx_providers_geog_active.
  -- Quando _lat/_lng vierem nulos, caímos no caminho sem geo (sem KNN).
  cand AS (
    SELECT p.*
    FROM public.providers p, ref
    WHERE p.status = 'approved'
      AND p.deleted_at IS NULL
      AND (
        ref.pt IS NULL
        OR (p.geog IS NOT NULL AND ST_DWithin(p.geog, ref.pt, _radius_m::float8))
      )
    ORDER BY
      CASE WHEN ref.pt IS NULL THEN NULL ELSE p.geog END <-> (SELECT pt FROM ref)
      NULLS LAST
    LIMIT GREATEST(_limit * 4, 200)  -- supersample para reordenar com score
  ),
  base AS (
    SELECT
      p.id, p.user_id,
      COALESCE(p.business_name, pr.full_name, 'Profissional') AS business_name,
      c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
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
      p.updated_at, p.created_at, p.last_active_at, p.completion_boost_until,
      COALESCE(p.account_type, 'autonomous') AS account_type,
      p.business_segment, p.street, p.street_number, p.complement, p.postal_code,
      COALESCE(p.social_links, '{}'::jsonb) AS social_links,
      COALESCE(p.show_full_address, false) AS show_full_address,
      CASE
        WHEN (SELECT pt FROM ref) IS NULL OR p.geog IS NULL THEN NULL::double precision
        ELSE ST_Distance(p.geog, (SELECT pt FROM ref))
      END AS distance_m,
      CASE WHEN _online_user_ids IS NULL THEN false ELSE p.user_id = ANY(_online_user_ids) END AS is_online,
      CASE
        WHEN EXISTS (SELECT 1 FROM public.daily_posts dp WHERE dp.provider_id = p.id AND dp.expires_at > now())
          OR EXISTS (SELECT 1 FROM public.leads l WHERE l.provider_id = p.id AND l.closed_at IS NOT NULL AND l.closed_at > (now() - interval '48 hours'))
        THEN 1.0 ELSE 0.0
      END AS recency_boost,
      CASE
        WHEN p.last_active_at IS NULL THEN 0.85
        WHEN p.last_active_at > (now() - interval '7 days') THEN 1.25
        WHEN p.last_active_at > (now() - interval '30 days') THEN 1.00
        ELSE 0.50
      END AS recency_factor,
      CASE
        WHEN p.completion_boost_until IS NOT NULL AND p.completion_boost_until > now() THEN 1.15
        ELSE 1.00
      END AS completion_factor
    FROM cand p
    LEFT JOIN public.profiles pr ON pr.id = p.user_id
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE (_category_slug IS NULL OR c.slug = _category_slug)
      AND (_account_type IS NULL OR COALESCE(p.account_type,'autonomous') = _account_type)
  ),
  scored AS (
    SELECT b.*,
      CASE
        WHEN b.distance_m IS NULL THEN 0.0
        WHEN b.distance_m <= 0 THEN 1.0
        WHEN b.distance_m >= _radius_m THEN 0.0
        ELSE GREATEST(0.0, LEAST(1.0, 1.0 - (b.distance_m / NULLIF(_radius_m, 0))))
      END AS distance_norm
    FROM base b
  ),
  final AS (
    SELECT s.*,
      ROUND((
        ((CASE WHEN s.is_online THEN 0.50 ELSE 0.0 END) +
         (s.distance_norm * 0.25) +
         (LEAST(s.engagement_points, 1000)::double precision / 1000.0 * 0.10) +
         (LEAST(s.rating_avg, 5)::double precision / 5.0 * 0.10) +
         (s.recency_boost * 0.05)
        ) * s.recency_factor * s.completion_factor
      )::numeric, 4)::double precision AS visibility_score,
      CASE
        WHEN s.is_online AND s.featured THEN 0
        WHEN s.is_online THEN 1
        WHEN s.featured THEN 2
        ELSE 3
      END AS level_priority,
      CASE
        WHEN s.completion_boost_until IS NOT NULL AND s.completion_boost_until > now() THEN 'em_alta'
        WHEN s.last_active_at IS NOT NULL AND s.last_active_at > (now() - interval '24 hours') THEN 'responde_rapido'
        WHEN s.last_active_at IS NOT NULL AND s.last_active_at > (now() - interval '7 days') THEN 'ativo_recente'
        ELSE NULL
      END AS activity_signal
    FROM scored s
  )
  SELECT
    id, user_id, business_name, category_name, category_slug, category_icon,
    city, state, neighborhood, latitude, longitude,
    rating_avg, review_count, photo_url, description, phone, whatsapp,
    years_experience, plan, slug, featured,
    services_count, portfolio_album_count, portfolio_photo_count,
    distance_m, is_online, visibility_score, activity_signal,
    account_type, business_segment, street, street_number, complement, postal_code, social_links,
    show_full_address
  FROM final
  WHERE (_lat IS NULL OR _lng IS NULL OR distance_m IS NULL OR distance_m <= _radius_m)
  ORDER BY
    level_priority ASC,
    visibility_score DESC NULLS LAST,
    recency_boost DESC NULLS LAST,
    engagement_points DESC NULLS LAST,
    rating_avg DESC NULLS LAST,
    created_at ASC NULLS LAST,
    user_id ASC
  LIMIT GREATEST(1, _limit);
$function$;

GRANT EXECUTE ON FUNCTION public.nearby_providers(double precision, double precision, integer, text, integer, uuid[], text) TO anon, authenticated;

COMMENT ON FUNCTION public.nearby_providers(double precision, double precision, integer, text, integer, uuid[], text)
IS 'Busca prestadores próximos via KNN (geog <-> ref_point) com índice GIST parcial idx_providers_geog_active. Mantém score híbrido + tie-breakers existentes.';

-- ============================================================
-- 3) TELEMETRIA DE QUERIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.query_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  duration_ms integer NOT NULL,
  rows_returned integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_query_telemetry_label_created
  ON public.query_telemetry (label, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_telemetry_created
  ON public.query_telemetry (created_at DESC);

ALTER TABLE public.query_telemetry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read query_telemetry" ON public.query_telemetry;
CREATE POLICY "admins read query_telemetry"
  ON public.query_telemetry FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "system insert query_telemetry" ON public.query_telemetry;
CREATE POLICY "system insert query_telemetry"
  ON public.query_telemetry FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RPC para log de telemetria (qualquer usuário autenticado pode chamar)
CREATE OR REPLACE FUNCTION public.log_query_telemetry(
  _label text,
  _duration_ms integer,
  _rows integer DEFAULT NULL,
  _meta jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF _label IS NULL OR length(_label) = 0 OR length(_label) > 64 THEN
    RETURN;
  END IF;
  INSERT INTO public.query_telemetry(label, duration_ms, rows_returned, meta, user_ref)
  VALUES (
    _label,
    GREATEST(0, LEAST(_duration_ms, 600000)),
    _rows,
    COALESCE(_meta, '{}'::jsonb),
    auth.uid()::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_query_telemetry(text, integer, integer, jsonb) TO authenticated;

-- RPC admin: roda EXPLAIN ANALYZE em SELECTs (apenas admin)
CREATE OR REPLACE FUNCTION public.admin_explain_query(_sql text)
RETURNS TABLE(plan text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_norm text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized' USING errcode = '42501';
  END IF;
  v_norm := lower(btrim(_sql));
  IF v_norm NOT LIKE 'select %' AND v_norm NOT LIKE 'with %' THEN
    RAISE EXCEPTION 'only SELECT/WITH queries allowed';
  END IF;
  IF v_norm ~* '\b(insert|update|delete|drop|truncate|alter|create|grant|revoke)\b' THEN
    RAISE EXCEPTION 'mutating keywords not allowed';
  END IF;

  RETURN QUERY EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ' || _sql;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_explain_query(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_explain_query(text) TO authenticated;

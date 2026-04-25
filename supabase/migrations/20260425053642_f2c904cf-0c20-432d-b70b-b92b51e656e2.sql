-- ============================================================
-- Sub-lote 4.1: Obra do Dia + Recency Boost (Ranking v3.2)
-- ============================================================

-- 1) Tabela daily_posts
CREATE TABLE IF NOT EXISTS public.daily_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  user_id uuid NOT NULL,
  image_url text,
  caption text NOT NULL CHECK (char_length(caption) BETWEEN 1 AND 240),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours')
);

CREATE INDEX IF NOT EXISTS idx_daily_posts_provider_active
  ON public.daily_posts (provider_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_posts_user
  ON public.daily_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_daily_posts_expires
  ON public.daily_posts (expires_at);

ALTER TABLE public.daily_posts ENABLE ROW LEVEL SECURITY;

-- Leitura pública apenas de posts ativos
DROP POLICY IF EXISTS "Daily posts ativos publicos" ON public.daily_posts;
CREATE POLICY "Daily posts ativos publicos"
ON public.daily_posts
FOR SELECT
USING (expires_at > now());

-- Dono pode tudo nos próprios posts
DROP POLICY IF EXISTS "Dono gerencia daily posts" ON public.daily_posts;
CREATE POLICY "Dono gerencia daily posts"
ON public.daily_posts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admin pode moderar/remover
DROP POLICY IF EXISTS "Admin gerencia daily posts" ON public.daily_posts;
CREATE POLICY "Admin gerencia daily posts"
ON public.daily_posts
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) RPC: create_daily_post
CREATE OR REPLACE FUNCTION public.create_daily_post(
  _image_url text,
  _caption text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_provider_id uuid;
  v_post_id uuid;
  v_caption text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  v_caption := btrim(COALESCE(_caption, ''));
  IF char_length(v_caption) = 0 OR char_length(v_caption) > 240 THEN
    RETURN jsonb_build_object('status', 'invalid_caption');
  END IF;

  SELECT id INTO v_provider_id
  FROM public.providers
  WHERE user_id = v_user AND deleted_at IS NULL
  LIMIT 1;

  IF v_provider_id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_provider');
  END IF;

  -- substitui o post ativo existente (apenas 1 ativo por profissional)
  DELETE FROM public.daily_posts
  WHERE provider_id = v_provider_id AND expires_at > now();

  INSERT INTO public.daily_posts (provider_id, user_id, image_url, caption)
  VALUES (v_provider_id, v_user, NULLIF(btrim(COALESCE(_image_url, '')), ''), v_caption)
  RETURNING id INTO v_post_id;

  -- Auditoria
  BEGIN
    INSERT INTO public.audit_log (user_id, action, target_type, target_id, metadata)
    VALUES (
      v_user,
      'daily_post_create',
      'daily_post',
      v_post_id,
      jsonb_build_object(
        'provider_id', v_provider_id,
        'caption_preview', left(v_caption, 80),
        'has_image', _image_url IS NOT NULL AND length(btrim(_image_url)) > 0
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'status', 'ok',
    'post_id', v_post_id,
    'expires_at', (now() + interval '48 hours')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_daily_post(text, text) TO authenticated;

-- 3) RPC: get_provider_daily_post
CREATE OR REPLACE FUNCTION public.get_provider_daily_post(_provider_id uuid)
RETURNS TABLE (
  id uuid,
  image_url text,
  caption text,
  created_at timestamptz,
  expires_at timestamptz,
  hours_remaining numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dp.id,
    dp.image_url,
    dp.caption,
    dp.created_at,
    dp.expires_at,
    ROUND(EXTRACT(EPOCH FROM (dp.expires_at - now())) / 3600.0, 1)::numeric AS hours_remaining
  FROM public.daily_posts dp
  WHERE dp.provider_id = _provider_id
    AND dp.expires_at > now()
  ORDER BY dp.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_provider_daily_post(uuid) TO anon, authenticated;

-- 4) RPC: delete_daily_post
CREATE OR REPLACE FUNCTION public.delete_daily_post()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  WITH del AS (
    DELETE FROM public.daily_posts
    WHERE user_id = v_user AND expires_at > now()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM del;

  RETURN jsonb_build_object('status', 'ok', 'deleted', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_daily_post() TO authenticated;

-- 5) Ranking v3.2: nearby_providers com Recency Boost
CREATE OR REPLACE FUNCTION public.nearby_providers(
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL,
  _radius_m integer DEFAULT 50000,
  _category_slug text DEFAULT NULL,
  _limit integer DEFAULT 50,
  _online_user_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid, user_id uuid, business_name text, category_name text, category_slug text, category_icon text,
  city text, state text, neighborhood text, latitude double precision, longitude double precision,
  rating_avg numeric, review_count integer, photo_url text, description text, phone text, whatsapp text,
  years_experience integer, plan text, slug text, featured boolean,
  services_count integer, portfolio_album_count integer, portfolio_photo_count integer,
  distance_m double precision, is_online boolean, visibility_score double precision
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
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
      p.updated_at,
      p.created_at,
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
      END AS is_online,
      -- Recency boost: 1.0 se tem Obra do Dia ativa OU lead concluído nas últimas 48h
      CASE
        WHEN EXISTS (
          SELECT 1 FROM public.daily_posts dp
          WHERE dp.provider_id = p.id AND dp.expires_at > now()
        ) OR EXISTS (
          SELECT 1 FROM public.leads l
          WHERE l.provider_id = p.id
            AND l.closed_at IS NOT NULL
            AND l.closed_at > (now() - interval '48 hours')
        )
        THEN 1.0
        ELSE 0.0
      END AS recency_boost
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
        (CASE WHEN s.is_online THEN 0.50 ELSE 0.0 END) +
        (s.distance_norm * 0.25) +
        (LEAST(s.engagement_points, 1000)::double precision / 1000.0 * 0.10) +
        (LEAST(s.rating_avg, 5)::double precision / 5.0 * 0.10) +
        (s.recency_boost * 0.05)
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
    recency_boost DESC NULLS LAST,
    engagement_points DESC NULLS LAST,
    rating_avg DESC NULLS LAST,
    created_at ASC NULLS LAST,
    user_id ASC
  LIMIT GREATEST(1, _limit);
$$;
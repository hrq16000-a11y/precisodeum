-- 1) Adicionar coluna de boost de conclusão temporário
ALTER TABLE public.providers 
  ADD COLUMN IF NOT EXISTS completion_boost_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_providers_completion_boost 
  ON public.providers(completion_boost_until) 
  WHERE completion_boost_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_providers_last_active 
  ON public.providers(last_active_at DESC NULLS LAST);

-- 2) Drop e recriar nearby_providers com nova coluna activity_signal
DROP FUNCTION IF EXISTS public.nearby_providers(double precision, double precision, integer, text, integer, uuid[]);

CREATE OR REPLACE FUNCTION public.nearby_providers(
  _lat double precision DEFAULT NULL::double precision,
  _lng double precision DEFAULT NULL::double precision,
  _radius_m integer DEFAULT 50000,
  _category_slug text DEFAULT NULL::text,
  _limit integer DEFAULT 50,
  _online_user_ids uuid[] DEFAULT NULL::uuid[]
)
 RETURNS TABLE(id uuid, user_id uuid, business_name text, category_name text, category_slug text, category_icon text, city text, state text, neighborhood text, latitude double precision, longitude double precision, rating_avg numeric, review_count integer, photo_url text, description text, phone text, whatsapp text, years_experience integer, plan text, slug text, featured boolean, services_count integer, portfolio_album_count integer, portfolio_photo_count integer, distance_m double precision, is_online boolean, visibility_score double precision, activity_signal text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      p.last_active_at,
      p.completion_boost_until,
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
        (
          (CASE WHEN s.is_online THEN 0.50 ELSE 0.0 END) +
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
    distance_m, is_online, visibility_score, activity_signal
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
$function$;

-- 3) RPC: register_service_completion
CREATE OR REPLACE FUNCTION public.register_service_completion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_provider_id uuid;
  v_boost_until timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT id INTO v_provider_id
  FROM public.providers
  WHERE user_id = auth.uid() AND deleted_at IS NULL
  LIMIT 1;

  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'provider_not_found';
  END IF;

  v_boost_until := now() + interval '3 days';

  UPDATE public.providers
  SET 
    last_active_at = now(),
    completion_boost_until = v_boost_until,
    updated_at = now()
  WHERE id = v_provider_id;

  INSERT INTO public.audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    auth.uid(),
    'service_completed',
    'provider',
    v_provider_id,
    jsonb_build_object('boost_until', v_boost_until)
  );

  RETURN jsonb_build_object(
    'success', true,
    'boost_until', v_boost_until,
    'boost_days', 3,
    'boost_multiplier', 1.15
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_service_completion() TO authenticated;

-- 4) Trigger: atualizar last_active_at em interações de alto valor
CREATE OR REPLACE FUNCTION public.touch_provider_on_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.interaction_type IN ('whatsapp', 'phone') THEN
    UPDATE public.providers
    SET last_active_at = GREATEST(COALESCE(last_active_at, now() - interval '999 days'), now() - interval '1 minute')
    WHERE id = NEW.provider_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_provider_on_interaction ON public.lead_interactions;
CREATE TRIGGER trg_touch_provider_on_interaction
  AFTER INSERT ON public.lead_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_provider_on_interaction();

-- 5) Habilitar realtime para lead_interactions
ALTER TABLE public.lead_interactions REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname='supabase_realtime' AND tablename='lead_interactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_interactions;
  END IF;
END $$;

-- 6) RPC: contagem de cliques 24h (para email de performance)
CREATE OR REPLACE FUNCTION public.get_provider_clicks_24h(_provider_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM public.lead_interactions
  WHERE provider_id = _provider_id
    AND interaction_type IN ('whatsapp', 'phone')
    AND created_at > (now() - interval '24 hours');
$$;

GRANT EXECUTE ON FUNCTION public.get_provider_clicks_24h(uuid) TO authenticated;
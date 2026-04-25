-- ============================================================
-- LOTE 2A — Missões + Ranking estável
-- ============================================================

-- 1. Tabela de controle de pontos creditados (anti-duplo crédito)
CREATE TABLE IF NOT EXISTS public.mission_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  mission_key text NOT NULL,
  points_awarded integer NOT NULL DEFAULT 5,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, mission_key)
);

ALTER TABLE public.mission_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner reads own mission completions" ON public.mission_completions;
CREATE POLICY "owner reads own mission completions"
  ON public.mission_completions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mission_completions_user
  ON public.mission_completions (user_id);

-- 2. Trigger: quando mission_answers muda, credita pontos por chaves novas
CREATE OR REPLACE FUNCTION public.handle_mission_answers_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
  v jsonb;
  awarded integer := 0;
BEGIN
  IF NEW.mission_answers IS NULL THEN
    RETURN NEW;
  END IF;

  -- Para cada chave nova ou mudada (não-null) que ainda não tem registro, credita +5
  FOR k, v IN SELECT key, value FROM jsonb_each(NEW.mission_answers)
  LOOP
    IF v IS NULL OR v::text = 'null' THEN
      CONTINUE;
    END IF;
    -- Se já estava no OLD com mesmo valor não-null, pula
    IF TG_OP = 'UPDATE'
       AND OLD.mission_answers IS NOT NULL
       AND OLD.mission_answers ? k
       AND OLD.mission_answers->k IS NOT NULL
       AND OLD.mission_answers->k::text <> 'null' THEN
      CONTINUE;
    END IF;

    -- Insere registro idempotente
    INSERT INTO public.mission_completions (provider_id, user_id, mission_key, points_awarded)
    VALUES (NEW.id, NEW.user_id, k, 5)
    ON CONFLICT (provider_id, mission_key) DO NOTHING;

    -- Se inserido agora, conta pra somar
    IF FOUND THEN
      awarded := awarded + 5;
    END IF;
  END LOOP;

  -- Credita engagement no profile dono
  IF awarded > 0 THEN
    UPDATE public.profiles
       SET engagement_points = COALESCE(engagement_points, 0) + awarded,
           updated_at = now()
     WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mission_answers_change ON public.providers;
CREATE TRIGGER trg_mission_answers_change
  AFTER INSERT OR UPDATE OF mission_answers ON public.providers
  FOR EACH ROW
  WHEN (NEW.mission_answers IS NOT NULL AND NEW.mission_answers <> '{}'::jsonb)
  EXECUTE FUNCTION public.handle_mission_answers_change();

-- 3. RPC pública para registrar resposta de uma missão (frontend usa esta)
CREATE OR REPLACE FUNCTION public.complete_mission(_key text, _value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_already boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF _key IS NULL OR length(trim(_key)) = 0 THEN
    RAISE EXCEPTION 'invalid_mission_key';
  END IF;

  SELECT id INTO v_provider_id
    FROM public.providers
   WHERE user_id = auth.uid()
   LIMIT 1;

  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'provider_not_found';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.mission_completions
     WHERE provider_id = v_provider_id AND mission_key = _key
  ) INTO v_already;

  -- Merge resposta (trigger se encarrega de creditar pontos)
  UPDATE public.providers
     SET mission_answers = COALESCE(mission_answers, '{}'::jsonb) || jsonb_build_object(_key, _value),
         updated_at = now()
   WHERE id = v_provider_id;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_already THEN 'already_completed' ELSE 'granted' END,
    'mission_key', _key,
    'points_awarded', CASE WHEN v_already THEN 0 ELSE 5 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_mission(text, jsonb) TO authenticated;

-- 4. Refatorar nearby_providers: tie-break estável + normalização robusta
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
  effective_radius integer;
BEGIN
  has_gps := _lat IS NOT NULL AND _lng IS NOT NULL
             AND _lat BETWEEN -90 AND 90 AND _lng BETWEEN -180 AND 180;

  -- Garante raio positivo para normalização (fallback 50km)
  effective_radius := COALESCE(NULLIF(_radius_m, 0), 50000);
  IF effective_radius < 100 THEN effective_radius := 100; END IF;

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
        ELSE NULL::double precision
      END AS dist_m_raw,
      p.rating_avg, p.review_count, p.photo_url,
      p.plan, p.featured, p.user_id,
      p.phone, p.whatsapp, p.description,
      p.years_experience, p.services_count,
      p.portfolio_album_count, p.portfolio_photo_count,
      p.updated_at,
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
        OR (p.geog IS NOT NULL AND ST_DWithin(p.geog, ref_point, effective_radius))
      )
  ),
  scored AS (
    SELECT
      b.*,
      -- Distance normalized robust: clamp 0..1, NULL→1.0 (sem GPS = sem boost geo)
      CASE
        WHEN NOT has_gps THEN 0.0::double precision
        WHEN b.dist_m_raw IS NULL THEN 1.0::double precision
        ELSE GREATEST(0.0, LEAST(1.0, b.dist_m_raw / effective_radius::double precision))
      END AS dist_norm,
      -- Distância exposta nunca null (0 quando ausente, para ordenação estável)
      COALESCE(b.dist_m_raw, 0.0::double precision) AS dist_m_safe
    FROM base b
  )
  SELECT
    s.id, s.slug, s.business_name,
    s.cat_name, s.cat_slug, s.cat_icon,
    s.city, s.state, s.neighborhood,
    s.latitude, s.longitude, s.dist_m_safe,
    s.rating_avg, s.review_count, s.photo_url,
    s.plan, s.featured, s.user_id,
    s.phone, s.whatsapp, s.description,
    s.years_experience, s.services_count,
    s.portfolio_album_count, s.portfolio_photo_count,
    s.online_flag AS is_online,
    ROUND(
      (((1.0 - s.dist_norm) * 0.7) + (CASE WHEN s.online_flag THEN 1.0 ELSE 0.0 END) * 0.3)::numeric,
      4
    )::double precision AS visibility_score
  FROM scored s
  ORDER BY
    s.lvl_priority DESC,
    s.featured DESC,
    -- score arredondado p/ 4 casas (já no SELECT) garante grupos estáveis
    (((1.0 - s.dist_norm) * 0.7) + (CASE WHEN s.online_flag THEN 1.0 ELSE 0.0 END) * 0.3) DESC,
    s.eng_points DESC,
    COALESCE(s.rating_avg, 0) DESC,
    COALESCE(s.review_count, 0) DESC,
    s.updated_at DESC NULLS LAST,
    s.user_id ASC                  -- desempate determinístico final
  LIMIT _limit;
END;
$function$;

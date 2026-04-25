-- ============================================================
-- Sub-lote 4.2: Oportunidade Perdida (Missed Opportunities)
-- ============================================================

-- 1) Tabela provider_presence_sessions
CREATE TABLE IF NOT EXISTS public.provider_presence_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_presence_user_started
  ON public.provider_presence_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_presence_active
  ON public.provider_presence_sessions (user_id, ended_at)
  WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_presence_window
  ON public.provider_presence_sessions (started_at, ended_at);

ALTER TABLE public.provider_presence_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dono le suas sessoes" ON public.provider_presence_sessions;
CREATE POLICY "Dono le suas sessoes"
ON public.provider_presence_sessions
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Dono insere sessoes" ON public.provider_presence_sessions;
CREATE POLICY "Dono insere sessoes"
ON public.provider_presence_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Dono atualiza sessoes" ON public.provider_presence_sessions;
CREATE POLICY "Dono atualiza sessoes"
ON public.provider_presence_sessions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin gerencia sessoes" ON public.provider_presence_sessions;
CREATE POLICY "Admin gerencia sessoes"
ON public.provider_presence_sessions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) RPC: track_presence_heartbeat
CREATE OR REPLACE FUNCTION public.track_presence_heartbeat()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_provider_id uuid;
  v_session_id uuid;
  v_last_hb timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  SELECT id INTO v_provider_id FROM public.providers
  WHERE user_id = v_user AND deleted_at IS NULL LIMIT 1;

  -- Sessão ativa mais recente
  SELECT id, last_heartbeat_at
    INTO v_session_id, v_last_hb
  FROM public.provider_presence_sessions
  WHERE user_id = v_user AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_session_id IS NULL OR v_last_hb < (now() - interval '5 minutes') THEN
    -- Fecha sessão estagnada
    IF v_session_id IS NOT NULL THEN
      UPDATE public.provider_presence_sessions
      SET ended_at = LEAST(now(), v_last_hb + interval '5 minutes')
      WHERE id = v_session_id;
    END IF;
    -- Abre nova
    INSERT INTO public.provider_presence_sessions (user_id, provider_id)
    VALUES (v_user, v_provider_id)
    RETURNING id INTO v_session_id;
    RETURN jsonb_build_object('status', 'started', 'session_id', v_session_id);
  ELSE
    UPDATE public.provider_presence_sessions
    SET last_heartbeat_at = now()
    WHERE id = v_session_id;
    RETURN jsonb_build_object('status', 'beat', 'session_id', v_session_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_presence_heartbeat() TO authenticated;

-- 3) RPC: close_presence_session
CREATE OR REPLACE FUNCTION public.close_presence_session()
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

  WITH upd AS (
    UPDATE public.provider_presence_sessions
    SET ended_at = now()
    WHERE user_id = v_user AND ended_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM upd;

  RETURN jsonb_build_object('status', 'ok', 'closed', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_presence_session() TO authenticated;

-- 4) RPC: get_missed_opportunities
CREATE OR REPLACE FUNCTION public.get_missed_opportunities(_provider_id uuid)
RETURNS TABLE (
  total_searches bigint,
  missed_searches bigint,
  top_neighborhood text,
  top_city text,
  top_location_label text,
  category_name text,
  hours_offline numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_category_id uuid;
  v_category_slug text;
  v_category_name text;
  v_provider_city text;
  v_window_start timestamptz := now() - interval '24 hours';
  v_total bigint := 0;
  v_missed bigint := 0;
  v_top_neighborhood text;
  v_top_city text;
  v_hours_offline numeric := 0;
BEGIN
  SELECT p.user_id, p.category_id, p.city, c.slug, c.name
    INTO v_owner, v_category_id, v_provider_city, v_category_slug, v_category_name
  FROM public.providers p
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE p.id = _provider_id;

  IF v_owner IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> v_owner THEN
    RETURN;
  END IF;

  -- Tempo offline nas últimas 24h = 24h - tempo coberto por sessões
  WITH sess AS (
    SELECT
      GREATEST(started_at, v_window_start) AS s,
      LEAST(COALESCE(ended_at, now()), now()) AS e
    FROM public.provider_presence_sessions
    WHERE user_id = v_owner
      AND COALESCE(ended_at, now()) > v_window_start
  ),
  online_secs AS (
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (e - s))), 0) AS secs FROM sess WHERE e > s
  )
  SELECT GREATEST(0, 24 - (online_secs.secs / 3600.0))
    INTO v_hours_offline
  FROM online_secs;

  -- Buscas elegíveis (categoria + cidade do profissional)
  WITH eligible_searches AS (
    SELECT
      a.created_at,
      a.details->>'neighborhood' AS neighborhood,
      a.details->>'city' AS city
    FROM public.audit_log a
    WHERE a.action = 'search'
      AND a.created_at >= v_window_start
      AND (
        a.details->>'category_id' = v_category_id::text
        OR a.details->>'category_slug' = v_category_slug
      )
      AND (
        v_provider_city IS NULL
        OR LOWER(COALESCE(a.details->>'city','')) = LOWER(v_provider_city)
      )
  ),
  with_offline AS (
    SELECT
      es.*,
      NOT EXISTS (
        SELECT 1 FROM public.provider_presence_sessions ps
        WHERE ps.user_id = v_owner
          AND ps.started_at <= es.created_at
          AND COALESCE(ps.ended_at, ps.last_heartbeat_at + interval '2 minutes') >= es.created_at
      ) AS was_offline
    FROM eligible_searches es
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE was_offline)
    INTO v_total, v_missed
  FROM with_offline;

  -- Top localização das buscas perdidas
  SELECT neighborhood, city
    INTO v_top_neighborhood, v_top_city
  FROM (
    SELECT
      a.details->>'neighborhood' AS neighborhood,
      a.details->>'city' AS city,
      COUNT(*) AS c
    FROM public.audit_log a
    WHERE a.action = 'search'
      AND a.created_at >= v_window_start
      AND (
        a.details->>'category_id' = v_category_id::text
        OR a.details->>'category_slug' = v_category_slug
      )
      AND (
        v_provider_city IS NULL
        OR LOWER(COALESCE(a.details->>'city','')) = LOWER(v_provider_city)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.provider_presence_sessions ps
        WHERE ps.user_id = v_owner
          AND ps.started_at <= a.created_at
          AND COALESCE(ps.ended_at, ps.last_heartbeat_at + interval '2 minutes') >= a.created_at
      )
    GROUP BY 1, 2
    ORDER BY c DESC
    LIMIT 1
  ) t;

  RETURN QUERY SELECT
    v_total,
    v_missed,
    v_top_neighborhood,
    v_top_city,
    NULLIF(TRIM(BOTH ' ' FROM
      COALESCE(v_top_neighborhood,'') ||
      CASE WHEN COALESCE(v_top_neighborhood,'') <> '' AND COALESCE(v_top_city,'') <> '' THEN ' - ' ELSE '' END ||
      COALESCE(v_top_city,'')
    ), '') AS top_location_label,
    v_category_name,
    ROUND(v_hours_offline::numeric, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_missed_opportunities(uuid) TO authenticated;

-- 5) Correção: create_daily_post agora usa colunas reais do audit_log
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

  DELETE FROM public.daily_posts
  WHERE provider_id = v_provider_id AND expires_at > now();

  INSERT INTO public.daily_posts (provider_id, user_id, image_url, caption)
  VALUES (v_provider_id, v_user, NULLIF(btrim(COALESCE(_image_url, '')), ''), v_caption)
  RETURNING id INTO v_post_id;

  BEGIN
    INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
    VALUES (
      v_user,
      'daily_post_create',
      'daily_post',
      v_post_id::text,
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
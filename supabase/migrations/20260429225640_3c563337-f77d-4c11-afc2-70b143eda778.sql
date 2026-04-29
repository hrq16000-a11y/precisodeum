-- =========================================================
-- PARTE 1: Telemetria de conversão de lead (clique → envio)
-- =========================================================

-- View materializada virtual: estatísticas diárias por provider
CREATE OR REPLACE VIEW public.lead_conversion_daily
WITH (security_invoker = true)
AS
SELECT
  p.id AS provider_id,
  date_trunc('day', li.created_at) AS day,
  count(*) FILTER (WHERE li.interaction_type IN ('whatsapp','phone')) AS contact_clicks,
  count(*) FILTER (WHERE li.interaction_type = 'profile') AS profile_clicks,
  count(*) FILTER (WHERE li.interaction_type = 'whatsapp') AS whatsapp_clicks,
  count(*) FILTER (WHERE li.interaction_type = 'phone')    AS phone_clicks
FROM public.providers p
LEFT JOIN public.lead_interactions li ON li.provider_id = p.id
GROUP BY p.id, date_trunc('day', li.created_at);

-- RPC: conversão lead (cliques de contato → lead criado) em janela
CREATE OR REPLACE FUNCTION public.get_lead_conversion_stats(
  _provider_id uuid DEFAULT NULL,
  _days int DEFAULT 30
)
RETURNS TABLE (
  provider_id uuid,
  contact_clicks bigint,
  leads_sent bigint,
  conversion_pct numeric,
  window_days int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pid uuid := _provider_id;
  v_days int := greatest(1, least(coalesce(_days, 30), 365));
  v_since timestamptz := now() - make_interval(days => v_days);
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  -- Se provider não informado, pega o do usuário logado
  IF v_pid IS NULL THEN
    SELECT id INTO v_pid FROM public.providers WHERE user_id = v_uid LIMIT 1;
  ELSE
    -- Só admin pode ver de outro provider
    IF NOT EXISTS (SELECT 1 FROM public.providers WHERE id = v_pid AND user_id = v_uid)
       AND NOT public.has_role(v_uid, 'admin'::app_role) THEN
      RETURN;
    END IF;
  END IF;

  IF v_pid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH clicks AS (
    SELECT count(*)::bigint AS n
    FROM public.lead_interactions li
    WHERE li.provider_id = v_pid
      AND li.interaction_type IN ('whatsapp','phone')
      AND li.created_at >= v_since
  ),
  sent AS (
    SELECT count(*)::bigint AS n
    FROM public.leads l
    WHERE l.provider_id = v_pid
      AND l.created_at >= v_since
  )
  SELECT
    v_pid,
    clicks.n,
    sent.n,
    CASE WHEN clicks.n > 0 THEN round((sent.n::numeric / clicks.n::numeric) * 100, 2) ELSE 0 END,
    v_days
  FROM clicks, sent;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lead_conversion_stats(uuid, int) TO authenticated;


-- =========================================================
-- PARTE 2: Retenção de provider pós-acesso ao dashboard
-- =========================================================

CREATE TABLE IF NOT EXISTS public.provider_dashboard_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  session_started_at timestamptz NOT NULL DEFAULT now(),
  route text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_provider_dashboard_sessions_provider_started
  ON public.provider_dashboard_sessions(provider_id, session_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_dashboard_sessions_user_started
  ON public.provider_dashboard_sessions(user_id, session_started_at DESC);

ALTER TABLE public.provider_dashboard_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "providers insert own dashboard session" ON public.provider_dashboard_sessions;
CREATE POLICY "providers insert own dashboard session"
  ON public.provider_dashboard_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "providers read own dashboard session" ON public.provider_dashboard_sessions;
CREATE POLICY "providers read own dashboard session"
  ON public.provider_dashboard_sessions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- RPC: retenção D1/D7/D30 (admin-only)
CREATE OR REPLACE FUNCTION public.get_provider_retention(_days int DEFAULT 30)
RETURNS TABLE (
  cohort_day date,
  cohort_size bigint,
  retained_d1 bigint,
  retained_d7 bigint,
  retained_d30 bigint,
  pct_d1 numeric,
  pct_d7 numeric,
  pct_d30 numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_days int := greatest(7, least(coalesce(_days, 30), 180));
  v_since timestamptz := now() - make_interval(days => v_days);
BEGIN
  IF NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH first_access AS (
    SELECT provider_id, min(session_started_at) AS first_seen
    FROM public.provider_dashboard_sessions
    WHERE session_started_at >= v_since
    GROUP BY provider_id
  ),
  cohorts AS (
    SELECT date_trunc('day', first_seen)::date AS cohort, provider_id, first_seen
    FROM first_access
  ),
  joined AS (
    SELECT
      c.cohort,
      c.provider_id,
      c.first_seen,
      EXISTS(SELECT 1 FROM public.provider_dashboard_sessions s
             WHERE s.provider_id = c.provider_id
               AND s.session_started_at >= c.first_seen + interval '20 hours'
               AND s.session_started_at <  c.first_seen + interval '2 days') AS d1,
      EXISTS(SELECT 1 FROM public.provider_dashboard_sessions s
             WHERE s.provider_id = c.provider_id
               AND s.session_started_at >= c.first_seen + interval '6 days'
               AND s.session_started_at <  c.first_seen + interval '8 days') AS d7,
      EXISTS(SELECT 1 FROM public.provider_dashboard_sessions s
             WHERE s.provider_id = c.provider_id
               AND s.session_started_at >= c.first_seen + interval '29 days'
               AND s.session_started_at <  c.first_seen + interval '31 days') AS d30
    FROM cohorts c
  )
  SELECT
    j.cohort,
    count(*)::bigint                                   AS cohort_size,
    count(*) FILTER (WHERE j.d1)::bigint               AS retained_d1,
    count(*) FILTER (WHERE j.d7)::bigint               AS retained_d7,
    count(*) FILTER (WHERE j.d30)::bigint              AS retained_d30,
    round(100.0 * count(*) FILTER (WHERE j.d1) / nullif(count(*),0), 2) AS pct_d1,
    round(100.0 * count(*) FILTER (WHERE j.d7) / nullif(count(*),0), 2) AS pct_d7,
    round(100.0 * count(*) FILTER (WHERE j.d30) / nullif(count(*),0), 2) AS pct_d30
  FROM joined j
  GROUP BY j.cohort
  ORDER BY j.cohort DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_provider_retention(int) TO authenticated;

-- RPC leve para registrar sessão do dashboard (chamada do front)
CREATE OR REPLACE FUNCTION public.record_dashboard_session(_route text DEFAULT NULL, _ua text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pid uuid;
  v_last timestamptz;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT id INTO v_pid FROM public.providers WHERE user_id = v_uid LIMIT 1;
  IF v_pid IS NULL THEN RETURN; END IF;

  -- Throttle: 1 sessão a cada 30 minutos por provider
  SELECT max(session_started_at) INTO v_last
  FROM public.provider_dashboard_sessions
  WHERE provider_id = v_pid;

  IF v_last IS NOT NULL AND v_last > now() - interval '30 minutes' THEN
    RETURN;
  END IF;

  INSERT INTO public.provider_dashboard_sessions(provider_id, user_id, route, user_agent)
  VALUES (v_pid, v_uid, left(coalesce(_route,''),200), left(coalesce(_ua,''),300));
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_dashboard_session(text, text) TO authenticated;


-- =========================================================
-- PARTE 3: Otimização FTS + paginação na inbox
-- =========================================================

-- 3.1 Coluna gerada (STORED) com tsvector ponderado — evita recomputar no rank
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS fts_pt tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('portuguese', coalesce(title,'')),   'A') ||
    setweight(to_tsvector('portuguese', coalesce(message,'')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(type,'')),    'C') ||
    setweight(to_tsvector('portuguese', coalesce(link,'')),    'D')
  ) STORED;

-- Substitui o índice antigo por um sobre a coluna materializada (mais rápido)
DROP INDEX IF EXISTS public.idx_notifications_fts_pt_weighted;
CREATE INDEX IF NOT EXISTS idx_notifications_fts_pt_stored
  ON public.notifications USING GIN (fts_pt);

-- 3.2 Índices auxiliares para filtros frequentes
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications(user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_type_created
  ON public.notifications(user_id, type, created_at DESC)
  WHERE type IS NOT NULL;

-- 3.3 Reescreve a RPC usando fts_pt materializado
DROP FUNCTION IF EXISTS public.search_user_notifications(text, text, text, int, int, text, timestamptz, timestamptz, uuid);

CREATE OR REPLACE FUNCTION public.search_user_notifications(
  _query       text         DEFAULT NULL,
  _status      text         DEFAULT 'all',
  _order       text         DEFAULT 'date',
  _limit       int          DEFAULT 50,
  _offset      int          DEFAULT 0,
  _type        text         DEFAULT NULL,
  _from        timestamptz  DEFAULT NULL,
  _to          timestamptz  DEFAULT NULL,
  _provider_id uuid         DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  message text,
  read boolean,
  type text,
  link text,
  created_at timestamptz,
  rank real,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_q   text := nullif(btrim(coalesce(_query,'')), '');
  v_tsq tsquery;
  v_lim int := greatest(1, least(coalesce(_limit, 50), 200));
  v_off int := greatest(0, coalesce(_offset, 0));
  v_pid text := CASE WHEN _provider_id IS NULL THEN NULL ELSE _provider_id::text END;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  IF v_q IS NOT NULL THEN
    v_tsq := websearch_to_tsquery('portuguese', v_q);
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      n.id, n.title, n.message, n.read, n.type, n.link, n.created_at,
      CASE
        WHEN v_tsq IS NULL THEN 0::real
        ELSE ts_rank_cd(n.fts_pt, v_tsq, 32)
      END AS rank
    FROM public.notifications n
    WHERE n.user_id = v_uid
      AND (_status = 'all'
           OR (_status = 'unread' AND n.read = false)
           OR (_status = 'read'   AND n.read = true))
      AND (_type IS NULL OR n.type = _type)
      AND (_from IS NULL OR n.created_at >= _from)
      AND (_to   IS NULL OR n.created_at <= _to)
      AND (
        v_pid IS NULL
        OR coalesce(n.link,'')    ILIKE '%' || v_pid || '%'
        OR coalesce(n.message,'') ILIKE '%' || v_pid || '%'
      )
      AND (
        v_tsq IS NULL
        OR n.fts_pt @@ v_tsq
        OR n.title   ILIKE '%' || v_q || '%'
        OR n.message ILIKE '%' || v_q || '%'
      )
  ),
  counted AS (
    SELECT b.*, count(*) OVER () AS total_count FROM base b
  )
  SELECT c.id, c.title, c.message, c.read, c.type, c.link, c.created_at, c.rank, c.total_count
  FROM counted c
  ORDER BY
    CASE WHEN _order = 'relevance' AND v_tsq IS NOT NULL THEN c.rank END DESC NULLS LAST,
    c.created_at DESC
  LIMIT v_lim OFFSET v_off;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_user_notifications(text, text, text, int, int, text, timestamptz, timestamptz, uuid) TO authenticated;
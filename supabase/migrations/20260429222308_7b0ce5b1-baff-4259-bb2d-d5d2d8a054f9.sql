
-- 1) Recriar índice GIN com tsvector PONDERADO (A=title, B=message, C=type, D=link)
DROP INDEX IF EXISTS public.idx_notifications_fts_pt;

CREATE INDEX IF NOT EXISTS idx_notifications_fts_pt_weighted
  ON public.notifications
  USING GIN (
    (
      setweight(to_tsvector('portuguese', coalesce(title,'')),   'A') ||
      setweight(to_tsvector('portuguese', coalesce(message,'')), 'B') ||
      setweight(to_tsvector('portuguese', coalesce(type,'')),    'C') ||
      setweight(to_tsvector('portuguese', coalesce(link,'')),    'D')
    )
  );

-- Índice auxiliar para filtro por período/usuário (se já existir, ignora)
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

-- 2) Recriar a RPC com pesos + filtros avançados
DROP FUNCTION IF EXISTS public.search_user_notifications(text, text, text, int, int);

CREATE OR REPLACE FUNCTION public.search_user_notifications(
  _query       text         DEFAULT NULL,
  _status      text         DEFAULT 'all',     -- 'all' | 'unread' | 'read'
  _order       text         DEFAULT 'date',    -- 'date' | 'relevance'
  _limit       int          DEFAULT 50,
  _offset      int          DEFAULT 0,
  _type        text         DEFAULT NULL,      -- filtro exato por tipo (NULL=todos)
  _from        timestamptz  DEFAULT NULL,      -- created_at >= _from
  _to          timestamptz  DEFAULT NULL,      -- created_at <= _to
  _provider_id uuid         DEFAULT NULL       -- match em link/message contendo provider id
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
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  IF v_q IS NOT NULL THEN
    v_tsq := websearch_to_tsquery('portuguese', v_q);
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      n.id, n.title, n.message, n.read, n.type, n.link, n.created_at,
      CASE
        WHEN v_tsq IS NULL THEN 0::real
        ELSE ts_rank_cd(
          setweight(to_tsvector('portuguese', coalesce(n.title,'')),   'A') ||
          setweight(to_tsvector('portuguese', coalesce(n.message,'')), 'B') ||
          setweight(to_tsvector('portuguese', coalesce(n.type,'')),    'C') ||
          setweight(to_tsvector('portuguese', coalesce(n.link,'')),    'D'),
          v_tsq,
          32 -- normalize by document length (log)
        )
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
        OR (
          setweight(to_tsvector('portuguese', coalesce(n.title,'')),   'A') ||
          setweight(to_tsvector('portuguese', coalesce(n.message,'')), 'B') ||
          setweight(to_tsvector('portuguese', coalesce(n.type,'')),    'C') ||
          setweight(to_tsvector('portuguese', coalesce(n.link,'')),    'D')
        ) @@ v_tsq
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

-- 3) Função auxiliar: lista distinct de tipos do usuário (para popular filtro)
CREATE OR REPLACE FUNCTION public.list_user_notification_types()
RETURNS TABLE (type text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.type, count(*)::bigint
  FROM public.notifications n
  WHERE n.user_id = auth.uid()
    AND n.type IS NOT NULL
  GROUP BY n.type
  ORDER BY count(*) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_user_notification_types() TO authenticated;

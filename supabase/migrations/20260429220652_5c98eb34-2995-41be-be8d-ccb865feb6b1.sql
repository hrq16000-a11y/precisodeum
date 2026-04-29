-- Índice GIN para FTS em português sobre title+message+type+link
CREATE INDEX IF NOT EXISTS idx_notifications_fts_pt
  ON public.notifications
  USING GIN (
    to_tsvector(
      'portuguese',
      coalesce(title,'') || ' ' || coalesce(message,'') || ' ' || coalesce(type,'') || ' ' || coalesce(link,'')
    )
  );

-- RPC: busca notificações do usuário logado com ranking
CREATE OR REPLACE FUNCTION public.search_user_notifications(
  _query text DEFAULT NULL,
  _status text DEFAULT 'all',     -- 'all' | 'unread' | 'read'
  _order  text DEFAULT 'date',    -- 'date' | 'relevance'
  _limit  int  DEFAULT 50,
  _offset int  DEFAULT 0
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  IF v_q IS NOT NULL THEN
    -- websearch_to_tsquery aceita "frase", -negação, OR — robusto p/ usuários
    v_tsq := websearch_to_tsquery('portuguese', v_q);
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT n.id, n.title, n.message, n.read, n.type, n.link, n.created_at,
      CASE
        WHEN v_tsq IS NULL THEN 0::real
        ELSE ts_rank(
          to_tsvector('portuguese',
            coalesce(n.title,'') || ' ' || coalesce(n.message,'') || ' ' ||
            coalesce(n.type,'')  || ' ' || coalesce(n.link,'')
          ),
          v_tsq
        )
      END AS rank
    FROM public.notifications n
    WHERE n.user_id = v_uid
      AND (_status = 'all'
           OR (_status = 'unread' AND n.read = false)
           OR (_status = 'read'   AND n.read = true))
      AND (
        v_tsq IS NULL
        OR to_tsvector('portuguese',
            coalesce(n.title,'') || ' ' || coalesce(n.message,'') || ' ' ||
            coalesce(n.type,'')  || ' ' || coalesce(n.link,'')
          ) @@ v_tsq
        OR n.title   ILIKE '%' || v_q || '%'   -- fallback substring
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

GRANT EXECUTE ON FUNCTION public.search_user_notifications(text, text, text, int, int) TO authenticated;
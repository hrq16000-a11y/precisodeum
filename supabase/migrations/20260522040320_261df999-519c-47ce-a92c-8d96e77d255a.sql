
-- 1) Deduplicar linhas existentes
WITH ranked AS (
  SELECT
    id,
    sponsor_id, slot_slug, event_type, COALESCE(page_path, '') AS pp, event_date,
    count,
    ROW_NUMBER() OVER (
      PARTITION BY sponsor_id, slot_slug, event_type, COALESCE(page_path, ''), event_date
      ORDER BY created_at, id
    ) AS rn,
    SUM(count) OVER (
      PARTITION BY sponsor_id, slot_slug, event_type, COALESCE(page_path, ''), event_date
    ) AS total_count
  FROM public.sponsor_metrics
)
UPDATE public.sponsor_metrics m
   SET count = r.total_count
  FROM ranked r
 WHERE m.id = r.id AND r.rn = 1 AND m.count <> r.total_count;

DELETE FROM public.sponsor_metrics m
 USING (
   SELECT id, ROW_NUMBER() OVER (
     PARTITION BY sponsor_id, slot_slug, event_type, COALESCE(page_path, ''), event_date
     ORDER BY created_at, id
   ) AS rn
   FROM public.sponsor_metrics
 ) r
 WHERE m.id = r.id AND r.rn > 1;

-- 2) Índice único (expressão COALESCE)
CREATE UNIQUE INDEX IF NOT EXISTS sponsor_metrics_unique_day
  ON public.sponsor_metrics (
    sponsor_id, slot_slug, event_type, (COALESCE(page_path, '')), event_date
  );

-- 3) RPC track_sponsor_metric com UPSERT real
CREATE OR REPLACE FUNCTION public.track_sponsor_metric(
  _sponsor_id uuid,
  _slot_slug text,
  _event_type text,
  _page_path text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_ref text;
BEGIN
  IF _event_type NOT IN ('impression','click') THEN
    RETURN;
  END IF;

  INSERT INTO public.sponsor_metrics (
    sponsor_id, slot_slug, event_type, page_path, event_date, count
  )
  VALUES (_sponsor_id, _slot_slug, _event_type, _page_path, CURRENT_DATE, 1)
  ON CONFLICT (sponsor_id, slot_slug, event_type, (COALESCE(page_path, '')), event_date)
  DO UPDATE SET count = public.sponsor_metrics.count + 1;

  IF _event_type = 'impression' THEN
    UPDATE public.sponsors SET impressions = impressions + 1 WHERE id = _sponsor_id;
    UPDATE public.sponsors
       SET delivered_impressions = delivered_impressions + 1
     WHERE id = _sponsor_id AND plan = 'pro';
  ELSIF _event_type = 'click' THEN
    UPDATE public.sponsors SET clicks = clicks + 1 WHERE id = _sponsor_id;
  END IF;

  SELECT user_ref INTO v_user_ref FROM public.sponsors WHERE id = _sponsor_id;

  IF _event_type = 'click' AND v_user_ref IS NOT NULL THEN
    INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'sponsor_ad_click',
      'sponsor',
      _sponsor_id,
      jsonb_build_object(
        'slot_slug', _slot_slug,
        'page_path', _page_path,
        'sponsor_user_ref', v_user_ref
      )
    );
  END IF;
END;
$$;

-- 4) RPC de leitura get_sponsor_performance
CREATE OR REPLACE FUNCTION public.get_sponsor_performance(
  _sponsor_id uuid DEFAULT NULL,
  _from date DEFAULT NULL,
  _to date DEFAULT NULL
) RETURNS TABLE (
  sponsor_id uuid,
  slot_slug text,
  impressions bigint,
  clicks bigint,
  ctr numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean := false;
  v_owner_ok boolean := false;
BEGIN
  BEGIN
    v_is_admin := public.has_role(auth.uid(), 'admin');
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;

  IF _sponsor_id IS NOT NULL AND auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.sponsors s
       WHERE s.id = _sponsor_id
         AND s.user_id = auth.uid()
    ) INTO v_owner_ok;
  END IF;

  IF NOT v_is_admin AND NOT v_owner_ok THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.sponsor_id,
    m.slot_slug,
    COALESCE(SUM(m.count) FILTER (WHERE m.event_type = 'impression'), 0)::bigint AS impressions,
    COALESCE(SUM(m.count) FILTER (WHERE m.event_type = 'click'), 0)::bigint      AS clicks,
    CASE
      WHEN COALESCE(SUM(m.count) FILTER (WHERE m.event_type = 'impression'), 0) = 0 THEN 0
      ELSE ROUND(
        (COALESCE(SUM(m.count) FILTER (WHERE m.event_type = 'click'), 0)::numeric
         / NULLIF(SUM(m.count) FILTER (WHERE m.event_type = 'impression'), 0)::numeric) * 100,
        2
      )
    END AS ctr
  FROM public.sponsor_metrics m
  WHERE (_sponsor_id IS NULL OR m.sponsor_id = _sponsor_id)
    AND (_from IS NULL OR m.event_date >= _from)
    AND (_to   IS NULL OR m.event_date <= _to)
  GROUP BY m.sponsor_id, m.slot_slug
  ORDER BY impressions DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sponsor_performance(uuid, date, date) TO authenticated;

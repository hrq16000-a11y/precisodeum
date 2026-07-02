-- Adds latency telemetry to list_whatsapp_contacts_history.
-- Strategy: lightweight RAISE LOG / RAISE WARNING (lands in postgres_logs,
-- accessible via Supabase analytics) when the RPC takes longer than the
-- soft / hard thresholds. No new table; the result also exposes _perf_ms.

CREATE OR REPLACE FUNCTION public.list_whatsapp_contacts_history(
  _search text DEFAULT NULL,
  _sort text DEFAULT 'recent',
  _limit int DEFAULT 20,
  _offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_limit int := LEAST(GREATEST(COALESCE(_limit, 20), 1), 100);
  v_offset int := GREATEST(COALESCE(_offset, 0), 0);
  v_search text := NULLIF(btrim(COALESCE(_search, '')), '');
  v_sort text := COALESCE(_sort, 'recent');
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_total int;
  v_rows jsonb;
  v_started timestamptz := clock_timestamp();
  v_elapsed_ms numeric;
  v_soft_ms constant int := 250;
  v_hard_ms constant int := 1000;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado' USING ERRCODE = '42501';
  END IF;

  IF v_sort NOT IN ('recent','recurring','provider') THEN
    v_sort := 'recent';
  END IF;

  WITH base AS (
    SELECT
      l.id, l.provider_id, l.clicked_at, l.clicked_on_utc,
      p.business_name, p.slug, p.whatsapp, p.phone, p.photo_url, p.city, p.state,
      unaccent(lower(coalesce(p.business_name,'') || ' ' || coalesce(p.city,''))) AS search_blob
    FROM public.whatsapp_clicks_log l
    LEFT JOIN public.providers p ON p.id = l.provider_id
    WHERE l.user_id = v_user_id
  ),
  filtered AS (
    SELECT * FROM base
    WHERE v_search IS NULL
       OR search_blob LIKE ('%' || unaccent(lower(v_search)) || '%')
  ),
  with_count AS (
    SELECT f.*, count(*) OVER (PARTITION BY f.provider_id) AS provider_total
    FROM filtered f
  ),
  ordered AS (
    SELECT *,
           CASE WHEN clicked_on_utc = v_today THEN 1 ELSE 0 END AS is_today
    FROM with_count
    ORDER BY
      CASE WHEN v_sort = 'recurring' THEN provider_total END DESC NULLS LAST,
      CASE WHEN v_sort = 'provider' THEN lower(coalesce(business_name,'zzz')) END ASC NULLS LAST,
      clicked_at DESC
  ),
  paged AS (
    SELECT * FROM ordered LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT count(*) FROM filtered),
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'provider_id', provider_id,
      'clicked_at', clicked_at,
      'clicked_on_utc', clicked_on_utc,
      'is_today', is_today = 1,
      'provider_total', provider_total,
      'provider', jsonb_build_object(
        'id', provider_id,
        'business_name', business_name,
        'slug', slug,
        'whatsapp', whatsapp,
        'phone', phone,
        'photo_url', photo_url,
        'city', city,
        'state', state
      )
    ) ORDER BY
      CASE WHEN v_sort = 'recurring' THEN provider_total END DESC NULLS LAST,
      CASE WHEN v_sort = 'provider' THEN lower(coalesce(business_name,'zzz')) END ASC NULLS LAST,
      clicked_at DESC
    ), '[]'::jsonb)
  INTO v_total, v_rows
  FROM paged;

  v_elapsed_ms := round(extract(epoch FROM (clock_timestamp() - v_started)) * 1000, 1);

  -- Threshold-based logs (postgres_logs / analytics).
  IF v_elapsed_ms >= v_hard_ms THEN
    RAISE WARNING
      'list_whatsapp_contacts_history slow user=% sort=% search_len=% limit=% offset=% total=% elapsed_ms=%',
      v_user_id, v_sort, COALESCE(length(v_search),0), v_limit, v_offset,
      COALESCE(v_total,0), v_elapsed_ms;
  ELSIF v_elapsed_ms >= v_soft_ms THEN
    RAISE LOG
      'list_whatsapp_contacts_history latency user=% sort=% search_len=% limit=% offset=% total=% elapsed_ms=%',
      v_user_id, v_sort, COALESCE(length(v_search),0), v_limit, v_offset,
      COALESCE(v_total,0), v_elapsed_ms;
  END IF;

  RETURN jsonb_build_object(
    'total', COALESCE(v_total, 0),
    'limit', v_limit,
    'offset', v_offset,
    'sort', v_sort,
    'search', v_search,
    'rows', v_rows,
    '_perf_ms', v_elapsed_ms
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_whatsapp_contacts_history(text, text, int, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_whatsapp_contacts_history(text, text, int, int) TO authenticated;
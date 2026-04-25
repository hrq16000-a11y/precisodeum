-- ============================================================
-- Sub-lote 4.3: Resumo Semanal de Impacto (Funil de Sucesso)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_provider_weekly_stats(_provider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_city text;
  v_now timestamptz := now();
  v_w1_start timestamptz := now() - interval '7 days';
  v_w2_start timestamptz := now() - interval '14 days';
  v_imp_w1 bigint := 0; v_imp_w2 bigint := 0;
  v_view_w1 bigint := 0; v_view_w2 bigint := 0;
  v_wa_w1 bigint := 0; v_wa_w2 bigint := 0;
  v_lead_w1 bigint := 0; v_lead_w2 bigint := 0;
  v_series jsonb;
BEGIN
  SELECT user_id, city INTO v_owner, v_city
  FROM public.providers WHERE id = _provider_id;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('available', false, 'reason', 'no_provider');
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> v_owner THEN
    RETURN jsonb_build_object('available', false, 'reason', 'forbidden');
  END IF;

  -- Impressões (card_view) últimos 7d
  SELECT COUNT(*) INTO v_imp_w1
  FROM public.audit_log
  WHERE action = 'card_view'
    AND created_at >= v_w1_start
    AND (details->>'provider_id' = _provider_id::text);

  -- Impressões 7d anteriores
  SELECT COUNT(*) INTO v_imp_w2
  FROM public.audit_log
  WHERE action = 'card_view'
    AND created_at >= v_w2_start AND created_at < v_w1_start
    AND (details->>'provider_id' = _provider_id::text);

  -- Visualizações de perfil
  SELECT COUNT(*) INTO v_view_w1
  FROM public.audit_log
  WHERE action = 'profile_view'
    AND created_at >= v_w1_start
    AND (details->>'provider_id' = _provider_id::text);

  SELECT COUNT(*) INTO v_view_w2
  FROM public.audit_log
  WHERE action = 'profile_view'
    AND created_at >= v_w2_start AND created_at < v_w1_start
    AND (details->>'provider_id' = _provider_id::text);

  -- Cliques WhatsApp
  SELECT COUNT(*) INTO v_wa_w1
  FROM public.audit_log
  WHERE action = 'whatsapp_click'
    AND created_at >= v_w1_start
    AND (details->>'provider_id' = _provider_id::text);

  SELECT COUNT(*) INTO v_wa_w2
  FROM public.audit_log
  WHERE action = 'whatsapp_click'
    AND created_at >= v_w2_start AND created_at < v_w1_start
    AND (details->>'provider_id' = _provider_id::text);

  -- Leads concluídos
  SELECT COUNT(*) INTO v_lead_w1
  FROM public.leads
  WHERE provider_id = _provider_id
    AND closed_at IS NOT NULL
    AND closed_at >= v_w1_start;

  SELECT COUNT(*) INTO v_lead_w2
  FROM public.leads
  WHERE provider_id = _provider_id
    AND closed_at IS NOT NULL
    AND closed_at >= v_w2_start AND closed_at < v_w1_start;

  -- Série diária últimos 7 dias
  WITH days AS (
    SELECT generate_series(
      date_trunc('day', v_w1_start),
      date_trunc('day', v_now),
      interval '1 day'
    )::date AS d
  ),
  imp AS (
    SELECT date_trunc('day', created_at)::date AS d, COUNT(*) AS c
    FROM public.audit_log
    WHERE action IN ('card_view','profile_view')
      AND created_at >= v_w1_start
      AND details->>'provider_id' = _provider_id::text
    GROUP BY 1
  ),
  wa AS (
    SELECT date_trunc('day', created_at)::date AS d, COUNT(*) AS c
    FROM public.audit_log
    WHERE action = 'whatsapp_click'
      AND created_at >= v_w1_start
      AND details->>'provider_id' = _provider_id::text
    GROUP BY 1
  ),
  ld AS (
    SELECT date_trunc('day', closed_at)::date AS d, COUNT(*) AS c
    FROM public.leads
    WHERE provider_id = _provider_id
      AND closed_at IS NOT NULL
      AND closed_at >= v_w1_start
    GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'date', to_char(days.d, 'YYYY-MM-DD'),
    'label', to_char(days.d, 'TMDy'),
    'impressions', COALESCE(imp.c, 0),
    'whatsapp', COALESCE(wa.c, 0),
    'leads', COALESCE(ld.c, 0)
  ) ORDER BY days.d)
  INTO v_series
  FROM days
  LEFT JOIN imp ON imp.d = days.d
  LEFT JOIN wa ON wa.d = days.d
  LEFT JOIN ld ON ld.d = days.d;

  RETURN jsonb_build_object(
    'available', true,
    'city', v_city,
    'period_label', 'Últimos 7 dias',
    'impressions', jsonb_build_object('current', v_imp_w1, 'previous', v_imp_w2,
      'delta_pct', CASE WHEN v_imp_w2 = 0 THEN NULL ELSE ROUND(((v_imp_w1 - v_imp_w2)::numeric / v_imp_w2) * 100, 1) END),
    'profile_views', jsonb_build_object('current', v_view_w1, 'previous', v_view_w2,
      'delta_pct', CASE WHEN v_view_w2 = 0 THEN NULL ELSE ROUND(((v_view_w1 - v_view_w2)::numeric / v_view_w2) * 100, 1) END),
    'whatsapp_clicks', jsonb_build_object('current', v_wa_w1, 'previous', v_wa_w2,
      'delta_pct', CASE WHEN v_wa_w2 = 0 THEN NULL ELSE ROUND(((v_wa_w1 - v_wa_w2)::numeric / v_wa_w2) * 100, 1) END),
    'leads_closed', jsonb_build_object('current', v_lead_w1, 'previous', v_lead_w2,
      'delta_pct', CASE WHEN v_lead_w2 = 0 THEN NULL ELSE ROUND(((v_lead_w1 - v_lead_w2)::numeric / v_lead_w2) * 100, 1) END),
    'series', COALESCE(v_series, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_provider_weekly_stats(uuid) TO authenticated;
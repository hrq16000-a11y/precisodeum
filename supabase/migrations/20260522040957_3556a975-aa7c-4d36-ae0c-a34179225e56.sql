
-- 1) Novos campos (idempotente)
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS pacing_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_delivery_check_at timestamptz;

-- Constraint de domínio do pacing_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sponsors_pacing_status_chk'
  ) THEN
    ALTER TABLE public.sponsors
      ADD CONSTRAINT sponsors_pacing_status_chk
      CHECK (pacing_status IN ('healthy','warning','critical','no_target','unknown'));
  END IF;
END $$;

-- 2) Índice para consulta diária em sponsor_metrics
CREATE INDEX IF NOT EXISTS idx_sponsor_metrics_date_event
  ON public.sponsor_metrics (event_date, event_type, sponsor_id);

-- 3) RPC de leitura: status de entrega
CREATE OR REPLACE FUNCTION public.get_sponsor_delivery_status(
  _only_active boolean DEFAULT true
) RETURNS TABLE (
  sponsor_id uuid,
  title text,
  company_name text,
  plan text,
  delivered_today bigint,
  delivered_total bigint,
  guaranteed_impressions integer,
  days_remaining integer,
  target_today numeric,
  pacing_percentage numeric,
  pacing_status text,
  ctr numeric,
  active_slots bigint,
  last_delivery_check_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean := false;
BEGIN
  BEGIN
    v_is_admin := public.has_role(auth.uid(), 'admin');
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH today_metrics AS (
    SELECT m.sponsor_id,
           SUM(m.count) FILTER (WHERE m.event_type='impression')::bigint AS imp_today,
           SUM(m.count) FILTER (WHERE m.event_type='click')::bigint      AS clk_today,
           COUNT(DISTINCT m.slot_slug) FILTER (WHERE m.event_type='impression')::bigint AS slots_today
      FROM public.sponsor_metrics m
     WHERE m.event_date = CURRENT_DATE
     GROUP BY m.sponsor_id
  ),
  totals AS (
    SELECT m.sponsor_id,
           SUM(m.count) FILTER (WHERE m.event_type='impression')::bigint AS imp_total,
           SUM(m.count) FILTER (WHERE m.event_type='click')::bigint      AS clk_total
      FROM public.sponsor_metrics m
     GROUP BY m.sponsor_id
  )
  SELECT
    s.id AS sponsor_id,
    s.title,
    s.company_name,
    s.plan,
    COALESCE(t.imp_today, 0) AS delivered_today,
    COALESCE(tot.imp_total, 0) AS delivered_total,
    s.guaranteed_impressions,
    CASE
      WHEN COALESCE(s.campaign_end, (s.end_date)::timestamptz) IS NULL THEN NULL
      ELSE GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM (COALESCE(s.campaign_end, (s.end_date)::timestamptz) - now())) / 86400.0)::int
      )
    END AS days_remaining,
    CASE
      WHEN s.guaranteed_impressions IS NULL OR s.guaranteed_impressions <= 0 THEN NULL
      WHEN COALESCE(s.campaign_end, (s.end_date)::timestamptz) IS NULL THEN NULL
      ELSE ROUND(
        GREATEST(0, s.guaranteed_impressions - COALESCE(s.delivered_impressions, 0))::numeric
        / GREATEST(
            1,
            CEIL(EXTRACT(EPOCH FROM (COALESCE(s.campaign_end, (s.end_date)::timestamptz) - now())) / 86400.0)::int
          ),
        2
      )
    END AS target_today,
    CASE
      WHEN s.guaranteed_impressions IS NULL OR s.guaranteed_impressions <= 0 THEN NULL
      WHEN COALESCE(s.campaign_end, (s.end_date)::timestamptz) IS NULL THEN NULL
      ELSE ROUND(
        100.0 * COALESCE(t.imp_today, 0)::numeric
        / NULLIF(
            GREATEST(0, s.guaranteed_impressions - COALESCE(s.delivered_impressions, 0))::numeric
            / GREATEST(
                1,
                CEIL(EXTRACT(EPOCH FROM (COALESCE(s.campaign_end, (s.end_date)::timestamptz) - now())) / 86400.0)::int
              ),
            0
          ),
        2
      )
    END AS pacing_percentage,
    s.pacing_status,
    CASE
      WHEN COALESCE(tot.imp_total, 0) = 0 THEN 0
      ELSE ROUND(100.0 * COALESCE(tot.clk_total, 0)::numeric / NULLIF(tot.imp_total, 0)::numeric, 2)
    END AS ctr,
    COALESCE(t.slots_today, 0) AS active_slots,
    s.last_delivery_check_at
  FROM public.sponsors s
  LEFT JOIN today_metrics t ON t.sponsor_id = s.id
  LEFT JOIN totals tot      ON tot.sponsor_id = s.id
  WHERE (_only_active IS FALSE OR (s.active = true AND s.status = 'active'))
  ORDER BY
    CASE s.pacing_status
      WHEN 'critical' THEN 1
      WHEN 'warning'  THEN 2
      WHEN 'healthy'  THEN 3
      WHEN 'no_target' THEN 4
      ELSE 5
    END,
    s.title;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sponsor_delivery_status(boolean) TO authenticated;

-- 4) RPC de manutenção: recalcula pacing_status de todos os ativos
CREATE OR REPLACE FUNCTION public.refresh_all_sponsor_pacing()
RETURNS TABLE (updated_count integer, critical_count integer, warning_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated int := 0;
  v_crit int := 0;
  v_warn int := 0;
BEGIN
  WITH today_metrics AS (
    SELECT m.sponsor_id,
           SUM(m.count) FILTER (WHERE m.event_type='impression')::bigint AS imp_today
      FROM public.sponsor_metrics m
     WHERE m.event_date = CURRENT_DATE
     GROUP BY m.sponsor_id
  ),
  computed AS (
    SELECT
      s.id,
      CASE
        WHEN s.guaranteed_impressions IS NULL OR s.guaranteed_impressions <= 0
          THEN 'no_target'
        WHEN COALESCE(s.campaign_end, (s.end_date)::timestamptz) IS NULL
          THEN 'no_target'
        ELSE
          (
            CASE
              WHEN COALESCE(t.imp_today, 0)::numeric
                   / NULLIF(
                       GREATEST(0, s.guaranteed_impressions - COALESCE(s.delivered_impressions, 0))::numeric
                       / GREATEST(
                           1,
                           CEIL(EXTRACT(EPOCH FROM (COALESCE(s.campaign_end, (s.end_date)::timestamptz) - now())) / 86400.0)::int
                         ),
                       0
                     ) >= 0.90
                THEN 'healthy'
              WHEN COALESCE(t.imp_today, 0)::numeric
                   / NULLIF(
                       GREATEST(0, s.guaranteed_impressions - COALESCE(s.delivered_impressions, 0))::numeric
                       / GREATEST(
                           1,
                           CEIL(EXTRACT(EPOCH FROM (COALESCE(s.campaign_end, (s.end_date)::timestamptz) - now())) / 86400.0)::int
                         ),
                       0
                     ) >= 0.70
                THEN 'warning'
              ELSE 'critical'
            END
          )
      END AS new_status
    FROM public.sponsors s
    LEFT JOIN today_metrics t ON t.sponsor_id = s.id
    WHERE s.active = true AND s.status = 'active'
  )
  UPDATE public.sponsors s
     SET pacing_status = c.new_status,
         last_delivery_check_at = now()
    FROM computed c
   WHERE s.id = c.id
     AND (s.pacing_status IS DISTINCT FROM c.new_status
          OR s.last_delivery_check_at IS NULL
          OR s.last_delivery_check_at < now() - interval '1 hour');

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT COUNT(*) FILTER (WHERE pacing_status='critical'),
         COUNT(*) FILTER (WHERE pacing_status='warning')
    INTO v_crit, v_warn
  FROM public.sponsors
  WHERE active = true AND status = 'active';

  -- Notificação leve para admins quando há críticos (uma por execução)
  IF v_crit > 0 THEN
    INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
    VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      'sponsor_pacing_alert',
      'sponsor',
      NULL,
      jsonb_build_object('critical_count', v_crit, 'warning_count', v_warn, 'checked_at', now())
    );
  END IF;

  RETURN QUERY SELECT v_updated, v_crit, v_warn;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_all_sponsor_pacing() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.refresh_all_sponsor_pacing() TO service_role;

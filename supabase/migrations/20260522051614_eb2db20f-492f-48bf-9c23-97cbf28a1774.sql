
-- =====================================================================
-- FASE 1.7 — SPONSOR HEALTH GATE
-- Funções determinísticas reutilizando campos existentes.
-- Nenhuma coluna nova; nenhuma state machine.
-- =====================================================================

-- 1) Health status RPC ------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sponsor_health_status(_sponsor_id uuid DEFAULT NULL)
RETURNS TABLE (
  sponsor_id uuid,
  title text,
  health_status text,
  blockers text[],
  warnings text[],
  expires_in_days integer,
  pacing_status text,
  has_asset boolean,
  scope_consistent boolean,
  is_active boolean,
  current_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      s.id,
      s.title,
      s.status,
      s.active,
      s.pacing_status,
      s.sponsor_type,
      s.linked_city_slug,
      s.linked_category_slug,
      s.image_url,
      s.logo_url,
      s.campaign_end,
      s.end_date,
      (s.image_url IS NOT NULL AND length(btrim(s.image_url)) > 0)
        OR (s.logo_url IS NOT NULL AND length(btrim(s.logo_url)) > 0)
        AS has_asset_calc,
      CASE
        WHEN s.sponsor_type = 'city'
          THEN s.linked_city_slug IS NOT NULL AND length(s.linked_city_slug) > 0
        WHEN s.sponsor_type = 'category'
          THEN s.linked_category_slug IS NOT NULL AND length(s.linked_category_slug) > 0
        ELSE TRUE
      END AS scope_ok,
      CASE
        WHEN s.campaign_end IS NOT NULL
          THEN GREATEST(0, (s.campaign_end::date - CURRENT_DATE))
        WHEN s.end_date IS NOT NULL
          THEN GREATEST(0, (s.end_date - CURRENT_DATE))
        ELSE NULL
      END AS days_left,
      (s.campaign_end IS NOT NULL AND s.campaign_end < now())
        OR (s.end_date IS NOT NULL AND s.end_date < CURRENT_DATE)
        AS is_expired
    FROM public.sponsors s
    WHERE s.deleted_at IS NULL
      AND (_sponsor_id IS NULL OR s.id = _sponsor_id)
  ),
  computed AS (
    SELECT
      b.*,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN b.is_expired THEN 'expired:campaign_window_closed' END,
        CASE WHEN NOT b.has_asset_calc THEN 'incomplete:missing_banner_or_logo' END,
        CASE WHEN NOT b.scope_ok THEN 'inconsistent:scope_slug_missing' END,
        CASE WHEN b.status = 'rejected' THEN 'blocked:rejected_by_admin' END
      ], NULL) AS blockers_calc,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN b.pacing_status = 'critical' THEN 'pacing:critical' END,
        CASE WHEN b.pacing_status = 'warning' THEN 'pacing:warning' END,
        CASE WHEN b.days_left IS NOT NULL AND b.days_left <= 7 AND NOT b.is_expired
             THEN 'expiry:within_7_days' END,
        CASE WHEN b.status = 'pending_approval' THEN 'approval:pending' END,
        CASE WHEN NOT b.active AND b.status = 'active' THEN 'flag:inactive_but_status_active' END
      ], NULL) AS warnings_calc
    FROM base b
  )
  SELECT
    c.id,
    c.title,
    CASE
      WHEN c.is_expired                   THEN 'expired'
      WHEN NOT c.scope_ok                 THEN 'inconsistent'
      WHEN NOT c.has_asset_calc           THEN 'incomplete'
      WHEN c.status = 'rejected'          THEN 'blocked'
      WHEN c.pacing_status = 'critical'
        OR (c.days_left IS NOT NULL AND c.days_left <= 7)
        OR c.status = 'pending_approval'  THEN 'warning'
      ELSE 'healthy'
    END,
    c.blockers_calc,
    c.warnings_calc,
    c.days_left,
    c.pacing_status,
    c.has_asset_calc,
    c.scope_ok,
    c.active,
    c.status
  FROM computed c
  ORDER BY
    CASE
      WHEN c.is_expired THEN 0
      WHEN NOT c.scope_ok THEN 1
      WHEN NOT c.has_asset_calc THEN 2
      WHEN c.status = 'rejected' THEN 3
      WHEN c.pacing_status = 'critical' OR (c.days_left IS NOT NULL AND c.days_left <= 7) THEN 4
      ELSE 5
    END,
    c.title;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sponsor_health_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sponsor_health_status(uuid) TO authenticated;


-- 2) Activate gate RPC ------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_sponsor_with_gate(
  _sponsor_id uuid,
  _override boolean DEFAULT false,
  _override_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_health record;
  v_blockers text[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_health
  FROM public.get_sponsor_health_status(_sponsor_id)
  LIMIT 1;

  IF v_health IS NULL THEN
    RAISE EXCEPTION 'sponsor_not_found';
  END IF;

  v_blockers := COALESCE(v_health.blockers, ARRAY[]::text[]);

  IF array_length(v_blockers, 1) > 0 AND NOT _override THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'blocked_by_gate',
      'health_status', v_health.health_status,
      'blockers', v_blockers
    );
  END IF;

  IF _override AND (_override_reason IS NULL OR length(btrim(_override_reason)) < 5) THEN
    RAISE EXCEPTION 'override_reason_required';
  END IF;

  UPDATE public.sponsors
     SET active = true,
         status = CASE WHEN status IN ('approved','active') THEN 'active' ELSE status END
   WHERE id = _sponsor_id;

  INSERT INTO public.audit_log (actor_id, action, resource_type, resource_id, metadata)
  VALUES (
    auth.uid(),
    CASE WHEN _override THEN 'sponsor_activate_override' ELSE 'sponsor_activate' END,
    'sponsor',
    _sponsor_id,
    jsonb_build_object(
      'health_status', v_health.health_status,
      'blockers', v_blockers,
      'warnings', v_health.warnings,
      'override', _override,
      'override_reason', _override_reason
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'health_status', v_health.health_status,
    'override', _override
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_sponsor_with_gate(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_sponsor_with_gate(uuid, boolean, text) TO authenticated;


-- 3) Auto-degrade leve (admin-triggered, não-destrutivo) --------------
CREATE OR REPLACE FUNCTION public.auto_degrade_expired_sponsors()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected integer := 0;
  v_ids uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH targets AS (
    SELECT id
    FROM public.sponsors
    WHERE deleted_at IS NULL
      AND active = true
      AND (
        (campaign_end IS NOT NULL AND campaign_end < now())
        OR (end_date IS NOT NULL AND end_date < CURRENT_DATE)
      )
  ),
  upd AS (
    UPDATE public.sponsors s
       SET active = false
      FROM targets t
     WHERE s.id = t.id
    RETURNING s.id
  )
  SELECT array_agg(id), count(*) INTO v_ids, v_affected FROM upd;

  IF v_affected > 0 THEN
    INSERT INTO public.audit_log (actor_id, action, resource_type, resource_id, metadata)
    SELECT auth.uid(),
           'sponsor_auto_degrade_expired',
           'sponsor',
           unnest(v_ids),
           jsonb_build_object('reason', 'campaign_window_closed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'affected', COALESCE(v_affected, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.auto_degrade_expired_sponsors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_degrade_expired_sponsors() TO authenticated;


-- Fase 1.9 — Delivery Health Telemetry
-- RPC 1: fire-and-forget reporter (com dedup server-side por janela de 10 min)
CREATE OR REPLACE FUNCTION public.record_sponsor_delivery_block(
  _sponsor_id uuid,
  _slot text,
  _reason text,
  _pathname text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_path text := COALESCE(NULLIF(trim(_pathname), ''), '/');
  v_reason text := COALESCE(NULLIF(trim(_reason), ''), 'unknown');
  v_slot text := COALESCE(NULLIF(trim(_slot), ''), 'unknown');
BEGIN
  IF _sponsor_id IS NULL THEN
    RETURN;
  END IF;

  -- Dedup server-side: ignora se já houve registro idêntico nos últimos 10 minutos
  IF EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE action = 'sponsor_delivery_blocked'
      AND resource_type = 'sponsor_delivery'
      AND resource_id = _sponsor_id::text
      AND created_at > now() - interval '10 minutes'
      AND details->>'slot' = v_slot
      AND details->>'reason' = v_reason
      AND details->>'pathname' = v_path
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    v_uid,
    'sponsor_delivery_blocked',
    'sponsor_delivery',
    _sponsor_id::text,
    jsonb_build_object('slot', v_slot, 'reason', v_reason, 'pathname', v_path)
  );
EXCEPTION WHEN OTHERS THEN
  -- Fail-soft: telemetria nunca quebra runtime
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_sponsor_delivery_block(uuid, text, text, text) TO anon, authenticated;

-- RPC 2: agregações admin-only
CREATE OR REPLACE FUNCTION public.get_sponsor_delivery_telemetry(_days int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz;
  v_total int;
  v_today int;
  v_by_reason jsonb;
  v_by_slot jsonb;
  v_top_sponsors jsonb;
  v_recent jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_since := now() - make_interval(days => GREATEST(1, LEAST(_days, 90)));

  SELECT count(*) INTO v_total
  FROM public.audit_log
  WHERE action = 'sponsor_delivery_blocked' AND created_at >= v_since;

  SELECT count(*) INTO v_today
  FROM public.audit_log
  WHERE action = 'sponsor_delivery_blocked' AND created_at >= date_trunc('day', now());

  SELECT COALESCE(jsonb_agg(jsonb_build_object('reason', reason, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_by_reason
  FROM (
    SELECT details->>'reason' AS reason, count(*) AS cnt
    FROM public.audit_log
    WHERE action = 'sponsor_delivery_blocked' AND created_at >= v_since
    GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('slot', slot, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_by_slot
  FROM (
    SELECT details->>'slot' AS slot, count(*) AS cnt
    FROM public.audit_log
    WHERE action = 'sponsor_delivery_blocked' AND created_at >= v_since
    GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'sponsor_id', t.sponsor_id,
      'title', s.title,
      'count', t.cnt,
      'top_reason', t.top_reason
    ) ORDER BY t.cnt DESC
  ), '[]'::jsonb)
  INTO v_top_sponsors
  FROM (
    SELECT
      resource_id::uuid AS sponsor_id,
      count(*) AS cnt,
      (array_agg(details->>'reason' ORDER BY created_at DESC))[1] AS top_reason
    FROM public.audit_log
    WHERE action = 'sponsor_delivery_blocked' AND created_at >= v_since
    GROUP BY resource_id
    ORDER BY cnt DESC
    LIMIT 20
  ) t
  LEFT JOIN public.sponsors s ON s.id = t.sponsor_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'sponsor_id', resource_id,
      'slot', details->>'slot',
      'reason', details->>'reason',
      'pathname', details->>'pathname',
      'created_at', created_at
    ) ORDER BY created_at DESC
  ), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT resource_id, details, created_at
    FROM public.audit_log
    WHERE action = 'sponsor_delivery_blocked' AND created_at >= v_since
    ORDER BY created_at DESC
    LIMIT 50
  ) t;

  RETURN jsonb_build_object(
    'window_days', _days,
    'total', v_total,
    'today', v_today,
    'by_reason', v_by_reason,
    'by_slot', v_by_slot,
    'top_sponsors', v_top_sponsors,
    'recent', v_recent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sponsor_delivery_telemetry(int) TO authenticated;

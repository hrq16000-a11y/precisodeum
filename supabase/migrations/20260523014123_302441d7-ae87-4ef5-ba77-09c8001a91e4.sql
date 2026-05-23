-- Phase 2.5: Sponsor Billing Foundation + Renewal Ops

CREATE TABLE IF NOT EXISTS public.sponsor_billing_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.sponsor_subscriptions(id) ON DELETE SET NULL,
  cycle_start timestamptz NOT NULL DEFAULT now(),
  cycle_end timestamptz NOT NULL,
  amount numeric(12,2),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','awaiting_payment','paid','overdue','grace','cancelled','expired')),
  payment_method text,
  invoice_reference text,
  renewal_requested boolean NOT NULL DEFAULT false,
  renewal_requested_at timestamptz,
  auto_renew boolean NOT NULL DEFAULT false,
  grace_until timestamptz,
  paid_at timestamptz,
  admin_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsor_billing_cycles_sponsor
  ON public.sponsor_billing_cycles(sponsor_id, status, cycle_end DESC);
CREATE INDEX IF NOT EXISTS idx_sponsor_billing_cycles_status
  ON public.sponsor_billing_cycles(status, cycle_end);
CREATE INDEX IF NOT EXISTS idx_sponsor_billing_cycles_renewal
  ON public.sponsor_billing_cycles(renewal_requested, status)
  WHERE renewal_requested = true;

ALTER TABLE public.sponsor_billing_cycles ENABLE ROW LEVEL SECURITY;

-- Sponsor reads own billing
CREATE POLICY "Sponsor reads own billing cycles"
ON public.sponsor_billing_cycles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sponsor_contacts sc
    WHERE sc.sponsor_id = sponsor_billing_cycles.sponsor_id
      AND sc.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- Admin-only direct updates (RPCs use SECURITY DEFINER)
CREATE POLICY "Admin manages billing cycles"
ON public.sponsor_billing_cycles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_sponsor_billing_cycles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sponsor_billing_cycles_updated_at ON public.sponsor_billing_cycles;
CREATE TRIGGER trg_sponsor_billing_cycles_updated_at
BEFORE UPDATE ON public.sponsor_billing_cycles
FOR EACH ROW EXECUTE FUNCTION public.set_sponsor_billing_cycles_updated_at();

-- =============================
-- RPC: sponsor_request_renewal
-- =============================
CREATE OR REPLACE FUNCTION public.sponsor_request_renewal(_sponsor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_is_owner boolean;
  v_cycle public.sponsor_billing_cycles%ROWTYPE;
  v_sub public.sponsor_subscriptions%ROWTYPE;
  v_default_end timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.sponsor_contacts sc
    WHERE sc.sponsor_id = _sponsor_id AND sc.user_id = v_user
  ) OR public.has_role(v_user, 'admin') INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sub
  FROM public.sponsor_subscriptions
  WHERE sponsor_id = _sponsor_id
  ORDER BY current_period_end DESC NULLS LAST
  LIMIT 1;

  -- Pick the latest open cycle, if any
  SELECT * INTO v_cycle
  FROM public.sponsor_billing_cycles
  WHERE sponsor_id = _sponsor_id
    AND status IN ('pending','awaiting_payment','overdue','grace')
  ORDER BY cycle_end DESC
  LIMIT 1;

  IF v_cycle.id IS NOT NULL THEN
    UPDATE public.sponsor_billing_cycles
    SET renewal_requested = true,
        renewal_requested_at = now()
    WHERE id = v_cycle.id;
  ELSE
    v_default_end := COALESCE(v_sub.current_period_end, now()) + interval '30 days';
    INSERT INTO public.sponsor_billing_cycles (
      sponsor_id, subscription_id, cycle_start, cycle_end,
      amount, status, renewal_requested, renewal_requested_at, created_by
    ) VALUES (
      _sponsor_id, v_sub.id, COALESCE(v_sub.current_period_end, now()), v_default_end,
      v_sub.amount_paid, 'pending', true, now(), v_user
    ) RETURNING * INTO v_cycle;
  END IF;

  INSERT INTO public.audit_log(action, resource_type, resource_id, user_id, details)
  VALUES ('update', 'sponsor_billing_cycle', v_cycle.id, v_user,
    jsonb_build_object('action_type', 'renewal_requested', 'sponsor_id', _sponsor_id));

  RETURN jsonb_build_object('ok', true, 'cycle_id', v_cycle.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sponsor_request_renewal(uuid) TO authenticated;

-- =============================
-- RPC: admin_mark_billing_paid
-- =============================
CREATE OR REPLACE FUNCTION public.admin_mark_billing_paid(
  _cycle_id uuid,
  _payment_method text DEFAULT NULL,
  _invoice_reference text DEFAULT NULL,
  _admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cycle public.sponsor_billing_cycles%ROWTYPE;
BEGIN
  IF NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.sponsor_billing_cycles
  SET status = 'paid',
      paid_at = now(),
      payment_method = COALESCE(_payment_method, payment_method),
      invoice_reference = COALESCE(_invoice_reference, invoice_reference),
      admin_note = COALESCE(_admin_note, admin_note),
      renewal_requested = false
  WHERE id = _cycle_id
  RETURNING * INTO v_cycle;

  IF v_cycle.id IS NULL THEN
    RAISE EXCEPTION 'cycle_not_found';
  END IF;

  INSERT INTO public.audit_log(action, resource_type, resource_id, user_id, details)
  VALUES ('update', 'sponsor_billing_cycle', _cycle_id, v_user,
    jsonb_build_object(
      'action_type', 'mark_paid',
      'sponsor_id', v_cycle.sponsor_id,
      'payment_method', _payment_method,
      'invoice_reference', _invoice_reference
    ));

  RETURN jsonb_build_object('ok', true, 'cycle_id', _cycle_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_mark_billing_paid(uuid, text, text, text) TO authenticated;

-- =============================
-- RPC: admin_update_billing_cycle
-- =============================
CREATE OR REPLACE FUNCTION public.admin_update_billing_cycle(
  _cycle_id uuid,
  _status text,
  _grace_until timestamptz DEFAULT NULL,
  _admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cycle public.sponsor_billing_cycles%ROWTYPE;
BEGIN
  IF NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF _status NOT IN ('pending','awaiting_payment','overdue','grace','cancelled','expired') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  UPDATE public.sponsor_billing_cycles
  SET status = _status,
      grace_until = CASE WHEN _status = 'grace' THEN COALESCE(_grace_until, grace_until, now() + interval '7 days')
                         ELSE grace_until END,
      admin_note = COALESCE(_admin_note, admin_note)
  WHERE id = _cycle_id
  RETURNING * INTO v_cycle;

  IF v_cycle.id IS NULL THEN
    RAISE EXCEPTION 'cycle_not_found';
  END IF;

  INSERT INTO public.audit_log(action, resource_type, resource_id, user_id, details)
  VALUES ('update', 'sponsor_billing_cycle', _cycle_id, v_user,
    jsonb_build_object('action_type', 'admin_update', 'new_status', _status, 'sponsor_id', v_cycle.sponsor_id));

  RETURN jsonb_build_object('ok', true, 'cycle_id', _cycle_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_billing_cycle(uuid, text, timestamptz, text) TO authenticated;

-- =============================
-- RPC: get_sponsor_billing_status
-- =============================
CREATE OR REPLACE FUNCTION public.get_sponsor_billing_status(_sponsor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_is_owner boolean;
  v_current public.sponsor_billing_cycles%ROWTYPE;
  v_history jsonb;
  v_sub public.sponsor_subscriptions%ROWTYPE;
  v_days_left int;
  v_health text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.sponsor_contacts sc
    WHERE sc.sponsor_id = _sponsor_id AND sc.user_id = v_user
  ) OR public.has_role(v_user, 'admin') INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_current
  FROM public.sponsor_billing_cycles
  WHERE sponsor_id = _sponsor_id
  ORDER BY cycle_end DESC
  LIMIT 1;

  SELECT * INTO v_sub
  FROM public.sponsor_subscriptions
  WHERE sponsor_id = _sponsor_id
  ORDER BY current_period_end DESC NULLS LAST
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(row_to_json(c) ORDER BY c.cycle_end DESC), '[]'::jsonb)
  INTO v_history
  FROM (
    SELECT id, cycle_start, cycle_end, amount, status, payment_method,
           invoice_reference, paid_at, renewal_requested, grace_until, admin_note
    FROM public.sponsor_billing_cycles
    WHERE sponsor_id = _sponsor_id
    ORDER BY cycle_end DESC
    LIMIT 12
  ) c;

  IF v_current.id IS NULL THEN
    v_health := 'healthy';
    v_days_left := NULL;
  ELSE
    v_days_left := GREATEST(0, EXTRACT(DAY FROM (v_current.cycle_end - now()))::int);
    v_health := CASE
      WHEN v_current.status = 'expired' THEN 'expired'
      WHEN v_current.status = 'cancelled' THEN 'expired'
      WHEN v_current.status = 'grace' THEN 'grace'
      WHEN v_current.status IN ('overdue','awaiting_payment') THEN 'awaiting_payment'
      WHEN v_current.status = 'paid' AND v_current.cycle_end > now() AND v_current.cycle_end <= now() + interval '7 days' THEN 'expiring_soon'
      WHEN v_current.cycle_end <= now() THEN 'expired'
      WHEN v_current.cycle_end <= now() + interval '7 days' THEN 'expiring_soon'
      ELSE 'healthy'
    END;
  END IF;

  RETURN jsonb_build_object(
    'sponsor_id', _sponsor_id,
    'health', v_health,
    'days_left', v_days_left,
    'current_cycle', CASE WHEN v_current.id IS NULL THEN NULL ELSE row_to_json(v_current) END,
    'subscription', CASE WHEN v_sub.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_sub.id, 'status', v_sub.status,
      'current_period_end', v_sub.current_period_end,
      'amount_paid', v_sub.amount_paid,
      'billing_cycle', v_sub.billing_cycle
    ) END,
    'history', v_history
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sponsor_billing_status(uuid) TO authenticated;

-- =============================
-- RPC: refresh_sponsor_billing_status (idempotente, chamado pelo cron)
-- =============================
CREATE OR REPLACE FUNCTION public.refresh_sponsor_billing_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_overdue int := 0;
  v_expired int := 0;
BEGIN
  -- Pending/awaiting que passaram do prazo viram overdue
  WITH upd AS (
    UPDATE public.sponsor_billing_cycles
    SET status = 'overdue'
    WHERE status IN ('pending','awaiting_payment')
      AND cycle_end < now()
    RETURNING 1
  ) SELECT count(*) INTO v_overdue FROM upd;

  -- Overdue/grace cujo grace_until expirou viram expired
  WITH upd AS (
    UPDATE public.sponsor_billing_cycles
    SET status = 'expired'
    WHERE status IN ('overdue','grace')
      AND (
        (status = 'grace' AND grace_until IS NOT NULL AND grace_until < now())
        OR (status = 'overdue' AND cycle_end < now() - interval '30 days')
      )
    RETURNING 1
  ) SELECT count(*) INTO v_expired FROM upd;

  RETURN jsonb_build_object('ok', true, 'overdue', v_overdue, 'expired', v_expired);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_sponsor_billing_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_sponsor_billing_status() TO service_role;
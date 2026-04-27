
-- 1. Tabela de pagamentos manuais
CREATE TABLE public.sponsor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.sponsor_subscriptions(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.sponsor_plans(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  payment_method text NOT NULL DEFAULT 'pix',
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','paid','failed','refunded')),
  paid_at timestamptz,
  period_start date,
  period_end date,
  external_reference text,
  receipt_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sponsor_payments_sponsor ON public.sponsor_payments(sponsor_id, paid_at DESC);
CREATE INDEX idx_sponsor_payments_subscription ON public.sponsor_payments(subscription_id);

ALTER TABLE public.sponsor_payments ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
CREATE TRIGGER trg_sponsor_payments_updated_at
BEFORE UPDATE ON public.sponsor_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Campos extras em sponsor_subscriptions para upgrade/downgrade agendado
ALTER TABLE public.sponsor_subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan_id uuid REFERENCES public.sponsor_plans(id),
  ADD COLUMN IF NOT EXISTS pending_change_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

-- 3. Helper: usuário é admin?
-- (assume função has_role já existente; caso não, fallback)
CREATE OR REPLACE FUNCTION public.is_sponsor_member(_sponsor_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sponsor_contacts
    WHERE sponsor_id = _sponsor_id AND user_id = _user_id
  );
$$;

-- 4. RLS sponsor_payments
CREATE POLICY "Admins manage sponsor payments"
ON public.sponsor_payments FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sponsor members view their payments"
ON public.sponsor_payments FOR SELECT
TO authenticated
USING (public.is_sponsor_member(sponsor_id, auth.uid()));

-- 5. RPC: uso atual versus limites
CREATE OR REPLACE FUNCTION public.get_sponsor_usage(_sponsor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan record;
  v_active_campaigns int;
  v_impressions_month bigint;
  v_subscription record;
BEGIN
  -- Verificação de acesso
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_sponsor_member(_sponsor_id, auth.uid())) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  SELECT s.*, p.name AS plan_name, p.slug AS plan_slug,
         p.max_slots, p.max_impressions, p.price_monthly, p.features
  INTO v_subscription
  FROM public.sponsor_subscriptions s
  LEFT JOIN public.sponsor_plans p ON p.id = s.plan_id
  WHERE s.sponsor_id = _sponsor_id
    AND s.status IN ('active','trialing','past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;

  SELECT COUNT(*) INTO v_active_campaigns
  FROM public.sponsor_campaigns
  WHERE sponsor_id = _sponsor_id
    AND active = true
    AND deleted_at IS NULL;

  SELECT COALESCE(SUM(impressions),0) INTO v_impressions_month
  FROM public.sponsor_campaigns
  WHERE sponsor_id = _sponsor_id
    AND deleted_at IS NULL
    AND created_at >= date_trunc('month', now());

  RETURN jsonb_build_object(
    'subscription', to_jsonb(v_subscription),
    'usage', jsonb_build_object(
      'active_campaigns', v_active_campaigns,
      'impressions_this_month', v_impressions_month
    ),
    'limits', jsonb_build_object(
      'max_slots', COALESCE(v_subscription.max_slots, 0),
      'max_impressions', COALESCE(v_subscription.max_impressions, 0)
    )
  );
END;
$$;

-- 6. RPC: pode criar nova campanha?
CREATE OR REPLACE FUNCTION public.sponsor_can_create_campaign(_sponsor_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_max int;
  v_count int;
BEGIN
  SELECT p.max_slots INTO v_max
  FROM public.sponsor_subscriptions s
  JOIN public.sponsor_plans p ON p.id = s.plan_id
  WHERE s.sponsor_id = _sponsor_id
    AND s.status IN ('active','trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_max IS NULL THEN RETURN false; END IF;
  IF v_max = -1 THEN RETURN true; END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.sponsor_campaigns
  WHERE sponsor_id = _sponsor_id AND active = true AND deleted_at IS NULL;

  RETURN v_count < v_max;
END;
$$;

-- 7. Trigger para bloquear criação acima do limite
CREATE OR REPLACE FUNCTION public.enforce_sponsor_campaign_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.active = true AND NEW.deleted_at IS NULL THEN
    IF NOT public.sponsor_can_create_campaign(NEW.sponsor_id) THEN
      RAISE EXCEPTION 'Limite de campanhas do plano atingido. Faça upgrade para criar mais.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_sponsor_campaign_limit ON public.sponsor_campaigns;
CREATE TRIGGER trg_enforce_sponsor_campaign_limit
BEFORE INSERT ON public.sponsor_campaigns
FOR EACH ROW EXECUTE FUNCTION public.enforce_sponsor_campaign_limit();

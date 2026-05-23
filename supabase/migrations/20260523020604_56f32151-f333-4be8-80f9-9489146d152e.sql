-- =====================================================================
-- Fase 2.7 — Sponsor Billing avançado (planos, performance, faturas, notificações)
-- =====================================================================

-- 1) Extensão de planos: duração, orçamento, performance, cotas por cidade/categoria
ALTER TABLE public.sponsor_plans
  ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS budget_limit numeric(12,2),
  ADD COLUMN IF NOT EXISTS performance_rate_per_lead numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS included_cities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS included_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS max_slots_per_city integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_slots_per_category integer NOT NULL DEFAULT 1;

-- 2) Extensão de ciclos: valor base + performance + breakdown
ALTER TABLE public.sponsor_billing_cycles
  ADD COLUMN IF NOT EXISTS base_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS performance_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS performance_leads integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3) Tabela de faturas/recibos
CREATE TABLE IF NOT EXISTS public.sponsor_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  billing_cycle_id uuid REFERENCES public.sponsor_billing_cycles(id) ON DELETE SET NULL,
  change_request_id uuid REFERENCES public.sponsor_change_requests(id) ON DELETE SET NULL,
  invoice_number bigserial UNIQUE NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  paid_at timestamptz,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','paid','void','refunded')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  pdf_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsor_invoices_sponsor ON public.sponsor_invoices(sponsor_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_sponsor_invoices_cycle ON public.sponsor_invoices(billing_cycle_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_invoices_status ON public.sponsor_invoices(status, issued_at DESC);

ALTER TABLE public.sponsor_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage sponsor_invoices" ON public.sponsor_invoices;
CREATE POLICY "Admins manage sponsor_invoices" ON public.sponsor_invoices
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Sponsor reads own invoices" ON public.sponsor_invoices;
CREATE POLICY "Sponsor reads own invoices" ON public.sponsor_invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sponsor_contacts sc
      WHERE sc.sponsor_id = sponsor_invoices.sponsor_id AND sc.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.set_sponsor_invoices_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_sponsor_invoices_updated_at ON public.sponsor_invoices;
CREATE TRIGGER trg_sponsor_invoices_updated_at
  BEFORE UPDATE ON public.sponsor_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_sponsor_invoices_updated_at();

-- 4) RPC: calcular valor de um ciclo (base + performance)
CREATE OR REPLACE FUNCTION public.compute_sponsor_cycle_amount(_cycle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle public.sponsor_billing_cycles;
  v_sub public.sponsor_subscriptions;
  v_plan public.sponsor_plans;
  v_base numeric(12,2) := 0;
  v_perf_leads integer := 0;
  v_perf_amount numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_breakdown jsonb;
BEGIN
  SELECT * INTO v_cycle FROM public.sponsor_billing_cycles WHERE id = _cycle_id;
  IF v_cycle.id IS NULL THEN
    RAISE EXCEPTION 'cycle_not_found';
  END IF;

  IF v_cycle.subscription_id IS NOT NULL THEN
    SELECT * INTO v_sub FROM public.sponsor_subscriptions WHERE id = v_cycle.subscription_id;
    IF v_sub.plan_id IS NOT NULL THEN
      SELECT * INTO v_plan FROM public.sponsor_plans WHERE id = v_sub.plan_id;
    END IF;
  END IF;

  -- Valor base do plano
  IF v_plan.id IS NOT NULL THEN
    IF COALESCE(v_sub.billing_cycle, 'monthly') = 'yearly' THEN
      v_base := COALESCE(v_plan.price_yearly, 0);
    ELSE
      v_base := COALESCE(v_plan.price_monthly, 0);
    END IF;
  ELSIF v_cycle.amount IS NOT NULL THEN
    v_base := v_cycle.amount;
  END IF;

  -- Leads no período
  SELECT COALESCE(SUM(sm.count), 0)::int INTO v_perf_leads
  FROM public.sponsor_metrics sm
  WHERE sm.sponsor_id = v_cycle.sponsor_id
    AND sm.event_type IN ('lead', 'lead_submit', 'conversion')
    AND sm.event_date >= v_cycle.cycle_start::date
    AND sm.event_date <= v_cycle.cycle_end::date;

  IF v_plan.id IS NOT NULL THEN
    v_perf_amount := v_perf_leads * COALESCE(v_plan.performance_rate_per_lead, 0);
  END IF;

  -- Respeita teto de orçamento
  v_total := v_base + v_perf_amount;
  IF v_plan.id IS NOT NULL AND v_plan.budget_limit IS NOT NULL AND v_total > v_plan.budget_limit THEN
    v_total := v_plan.budget_limit;
    v_perf_amount := GREATEST(0, v_total - v_base);
  END IF;

  v_breakdown := jsonb_build_object(
    'base_amount', v_base,
    'performance_amount', v_perf_amount,
    'performance_leads', v_perf_leads,
    'rate_per_lead', COALESCE(v_plan.performance_rate_per_lead, 0),
    'plan_id', v_plan.id,
    'plan_name', v_plan.name,
    'budget_limit', v_plan.budget_limit,
    'computed_at', now()
  );

  UPDATE public.sponsor_billing_cycles
     SET base_amount = v_base,
         performance_amount = v_perf_amount,
         performance_leads = v_perf_leads,
         amount = v_total,
         breakdown = v_breakdown
   WHERE id = _cycle_id;

  RETURN v_breakdown || jsonb_build_object('total_amount', v_total);
END $$;

REVOKE ALL ON FUNCTION public.compute_sponsor_cycle_amount(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_sponsor_cycle_amount(uuid) TO authenticated, service_role;

-- 5) Helper: criar fatura a partir de um ciclo
CREATE OR REPLACE FUNCTION public.generate_invoice_for_cycle(_cycle_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle public.sponsor_billing_cycles;
  v_calc jsonb;
  v_invoice_id uuid;
BEGIN
  SELECT * INTO v_cycle FROM public.sponsor_billing_cycles WHERE id = _cycle_id;
  IF v_cycle.id IS NULL THEN
    RAISE EXCEPTION 'cycle_not_found';
  END IF;

  v_calc := public.compute_sponsor_cycle_amount(_cycle_id);

  INSERT INTO public.sponsor_invoices (
    sponsor_id, billing_cycle_id, due_at, total_amount, items, notes, created_by
  )
  VALUES (
    v_cycle.sponsor_id,
    v_cycle.id,
    v_cycle.cycle_end,
    COALESCE((v_calc->>'total_amount')::numeric, 0),
    jsonb_build_array(
      jsonb_build_object(
        'description', 'Mensalidade ' || COALESCE(v_calc->>'plan_name', 'plano'),
        'amount', COALESCE((v_calc->>'base_amount')::numeric, 0)
      ),
      jsonb_build_object(
        'description', COALESCE(v_calc->>'performance_leads', '0') || ' leads x R$ ' || COALESCE(v_calc->>'rate_per_lead', '0'),
        'amount', COALESCE((v_calc->>'performance_amount')::numeric, 0)
      )
    ),
    'Fatura gerada automaticamente para o ciclo ' || to_char(v_cycle.cycle_start, 'DD/MM/YYYY') || ' a ' || to_char(v_cycle.cycle_end, 'DD/MM/YYYY'),
    auth.uid()
  )
  RETURNING id INTO v_invoice_id;

  RETURN v_invoice_id;
END $$;

REVOKE ALL ON FUNCTION public.generate_invoice_for_cycle(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_invoice_for_cycle(uuid) TO authenticated, service_role;

-- 6) Helper: criar fatura a partir de uma solicitação de mudança aprovada
CREATE OR REPLACE FUNCTION public.admin_generate_invoice_for_change_request(_request_id uuid, _amount numeric DEFAULT NULL, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.sponsor_change_requests;
  v_invoice_id uuid;
  v_amount numeric(12,2);
  v_items jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_req FROM public.sponsor_change_requests WHERE id = _request_id;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_req.status <> 'approved' THEN RAISE EXCEPTION 'request_not_approved'; END IF;

  v_amount := COALESCE(_amount, 0);
  v_items := jsonb_build_array(
    jsonb_build_object(
      'description', 'Ajuste por solicitação ' || left(_request_id::text, 8),
      'amount', v_amount,
      'changes', v_req.changes
    )
  );

  INSERT INTO public.sponsor_invoices (
    sponsor_id, change_request_id, total_amount, items, notes, created_by, status
  )
  VALUES (
    v_req.sponsor_id, v_req.id, v_amount, v_items,
    COALESCE(_note, 'Fatura por mudança aprovada de campanha'),
    auth.uid(),
    CASE WHEN v_amount = 0 THEN 'paid' ELSE 'issued' END
  )
  RETURNING id INTO v_invoice_id;

  RETURN v_invoice_id;
END $$;

REVOKE ALL ON FUNCTION public.admin_generate_invoice_for_change_request(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_generate_invoice_for_change_request(uuid, numeric, text) TO authenticated;

-- 7) Trigger: ao aprovar mudança que impacta plano/duração/orçamento, gera fatura automática (valor=0 se não souber)
CREATE OR REPLACE FUNCTION public.trg_auto_invoice_on_change_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_billing_impact boolean := false;
BEGIN
  IF NEW.status = 'approved' AND COALESCE(OLD.status, '') <> 'approved' THEN
    IF (NEW.changes ? 'plan_id')
       OR (NEW.changes ? 'duration_days')
       OR (NEW.changes ? 'budget_limit')
       OR (NEW.changes ? 'billing_cycle') THEN
      v_has_billing_impact := true;
    END IF;

    IF v_has_billing_impact THEN
      INSERT INTO public.sponsor_invoices (
        sponsor_id, change_request_id, total_amount, items, notes, status
      ) VALUES (
        NEW.sponsor_id, NEW.id, 0,
        jsonb_build_array(jsonb_build_object(
          'description', 'Recibo de aprovação de alteração de campanha',
          'changes', NEW.changes
        )),
        'Recibo emitido automaticamente na aprovação da solicitação',
        'paid'
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sponsor_change_request_auto_invoice ON public.sponsor_change_requests;
CREATE TRIGGER trg_sponsor_change_request_auto_invoice
  AFTER UPDATE OF status ON public.sponsor_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_invoice_on_change_approval();

-- 8) Notificações: helper para notificar admins
CREATE OR REPLACE FUNCTION public.notify_admins_about_sponsor(_sponsor_id uuid, _type text, _title text, _message text, _link text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin record;
BEGIN
  FOR v_admin IN
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'::public.app_role
  LOOP
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (v_admin.user_id, _type, _title, _message, COALESCE(_link, '/admin/sponsor-billing'));
    EXCEPTION WHEN OTHERS THEN
      -- não bloqueia ciclo principal por falha de notificação
      NULL;
    END;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.notify_admins_about_sponsor(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_admins_about_sponsor(uuid, text, text, text, text) TO authenticated, service_role;

-- 9) Notificar patrocinador (todos os contatos)
CREATE OR REPLACE FUNCTION public.notify_sponsor_contacts(_sponsor_id uuid, _type text, _title text, _message text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_c record;
BEGIN
  FOR v_c IN
    SELECT sc.user_id FROM public.sponsor_contacts sc WHERE sc.sponsor_id = _sponsor_id AND sc.user_id IS NOT NULL
  LOOP
    BEGIN
      INSERT INTO public.sponsor_notifications (sponsor_id, user_id, type, title, message)
      VALUES (_sponsor_id, v_c.user_id, _type, _title, _message);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.notify_sponsor_contacts(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_sponsor_contacts(uuid, text, text, text) TO authenticated, service_role;

-- 10) Trigger: notificações em mudanças de status de ciclo
CREATE OR REPLACE FUNCTION public.trg_notify_billing_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_msg text;
BEGIN
  IF NEW.status IS DISTINCT FROM COALESCE(OLD.status, '') THEN
    CASE NEW.status
      WHEN 'overdue' THEN
        v_title := 'Pagamento em atraso';
        v_msg := 'Seu ciclo de cobrança está em atraso. Regularize para evitar a suspensão da campanha.';
      WHEN 'awaiting_payment' THEN
        v_title := 'Aguardando pagamento';
        v_msg := 'Há um ciclo aguardando confirmação de pagamento.';
      WHEN 'expired' THEN
        v_title := 'Cobrança expirada';
        v_msg := 'O ciclo atual expirou. Solicite renovação para reativar a campanha.';
      WHEN 'paid' THEN
        v_title := 'Pagamento confirmado';
        v_msg := 'Recebemos a confirmação de pagamento do ciclo atual.';
      WHEN 'grace' THEN
        v_title := 'Período de tolerância';
        v_msg := 'Concedemos um período de tolerância para regularização.';
      ELSE
        RETURN NEW;
    END CASE;

    PERFORM public.notify_sponsor_contacts(NEW.sponsor_id, 'billing', v_title, v_msg);

    IF NEW.status IN ('overdue', 'expired') THEN
      PERFORM public.notify_admins_about_sponsor(
        NEW.sponsor_id, 'billing', v_title,
        'Patrocinador ' || NEW.sponsor_id::text || ': ' || v_msg,
        '/admin/sponsor-billing'
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_billing_status_change_notify ON public.sponsor_billing_cycles;
CREATE TRIGGER trg_billing_status_change_notify
  AFTER UPDATE OF status ON public.sponsor_billing_cycles
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_billing_status_change();

-- 11) Trigger: notificar quando renovação for solicitada
CREATE OR REPLACE FUNCTION public.trg_notify_renewal_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.renewal_requested = true AND COALESCE(OLD.renewal_requested, false) = false THEN
    PERFORM public.notify_admins_about_sponsor(
      NEW.sponsor_id, 'billing', 'Renovação solicitada',
      'Patrocinador ' || NEW.sponsor_id::text || ' solicitou renovação do ciclo atual.',
      '/admin/sponsor-billing'
    );
    PERFORM public.notify_sponsor_contacts(
      NEW.sponsor_id, 'billing', 'Renovação registrada',
      'Sua solicitação de renovação foi recebida. Em breve nosso time entrará em contato.'
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_billing_renewal_notify ON public.sponsor_billing_cycles;
CREATE TRIGGER trg_billing_renewal_notify
  AFTER UPDATE OF renewal_requested ON public.sponsor_billing_cycles
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_renewal_request();

-- 12) Trigger: notificar falhas de pagamento
CREATE OR REPLACE FUNCTION public.trg_notify_payment_failed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'failed' AND COALESCE(OLD.status, '') <> 'failed' THEN
    PERFORM public.notify_sponsor_contacts(
      NEW.sponsor_id, 'billing', 'Falha no pagamento',
      'Identificamos uma falha no seu último pagamento. Verifique os dados ou tente novamente.'
    );
    PERFORM public.notify_admins_about_sponsor(
      NEW.sponsor_id, 'billing', 'Falha em pagamento de patrocinador',
      'Pagamento ' || NEW.id::text || ' marcado como falho para o patrocinador ' || NEW.sponsor_id::text || '.',
      '/admin/sponsor-billing'
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payment_failed_notify ON public.sponsor_payments;
CREATE TRIGGER trg_payment_failed_notify
  AFTER INSERT OR UPDATE OF status ON public.sponsor_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_payment_failed();

-- 13) RPC: leitura de faturas (sponsor lê suas, admin lê tudo)
CREATE OR REPLACE FUNCTION public.list_sponsor_invoices(_sponsor_id uuid, _limit int DEFAULT 30)
RETURNS SETOF public.sponsor_invoices
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
    FROM public.sponsor_invoices i
   WHERE i.sponsor_id = _sponsor_id
     AND (
       public.has_role(auth.uid(), 'admin'::public.app_role)
       OR EXISTS (
         SELECT 1 FROM public.sponsor_contacts sc
          WHERE sc.sponsor_id = _sponsor_id AND sc.user_id = auth.uid()
       )
     )
   ORDER BY i.issued_at DESC
   LIMIT GREATEST(1, LEAST(_limit, 200));
$$;

REVOKE ALL ON FUNCTION public.list_sponsor_invoices(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_sponsor_invoices(uuid, int) TO authenticated;
-- 1) Guard: sponsors não podem se auto-aprovar nem editar métricas de plano
CREATE OR REPLACE FUNCTION public.guard_sponsor_moderation_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  NEW.status := OLD.status;
  IF to_jsonb(NEW) ? 'plan_tier' THEN NEW.plan_tier := OLD.plan_tier; END IF;
  IF to_jsonb(NEW) ? 'guaranteed_impressions' THEN NEW.guaranteed_impressions := OLD.guaranteed_impressions; END IF;
  IF to_jsonb(NEW) ? 'delivered_impressions' THEN NEW.delivered_impressions := OLD.delivered_impressions; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_sponsor_moderation ON public.sponsors;
CREATE TRIGGER trg_guard_sponsor_moderation
BEFORE UPDATE ON public.sponsors
FOR EACH ROW EXECUTE FUNCTION public.guard_sponsor_moderation_columns();

-- 2) Templates de e-mail (Resend) editáveis pelo admin
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage email templates" ON public.email_templates;
CREATE POLICY "Admins manage email templates"
ON public.email_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_email_templates()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_email_templates ON public.email_templates;
CREATE TRIGGER trg_touch_email_templates
BEFORE UPDATE ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_email_templates();

-- 3) Conversões de contato por rota/categoria
CREATE OR REPLACE FUNCTION public.get_contact_conversion_report(
  _days integer DEFAULT 30,
  _provider_id uuid DEFAULT NULL
)
RETURNS TABLE (
  page_path text,
  category_slug text,
  provider_kind text,
  whatsapp_clicks bigint,
  phone_clicks bigint,
  profile_clicks bigint,
  total_clicks bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce(cc.page_path, '(sem rota)') AS page_path,
    coalesce(cc.category_slug, '(sem categoria)') AS category_slug,
    CASE WHEN coalesce(p.cnpj, '') <> '' THEN 'company' ELSE 'individual' END AS provider_kind,
    count(*) FILTER (WHERE cc.contact_type = 'whatsapp') AS whatsapp_clicks,
    count(*) FILTER (WHERE cc.contact_type = 'phone') AS phone_clicks,
    count(*) FILTER (WHERE cc.contact_type = 'profile') AS profile_clicks,
    count(*) AS total_clicks
  FROM public.contact_clicks cc
  JOIN public.providers p ON p.id = cc.provider_id
  WHERE cc.created_at >= now() - make_interval(days => greatest(1, least(365, coalesce(_days, 30))))
    AND (
      (_provider_id IS NOT NULL AND cc.provider_id = _provider_id AND p.user_id = auth.uid())
      OR (_provider_id IS NULL AND public.has_role(auth.uid(), 'admin'))
    )
  GROUP BY 1, 2, 3
  ORDER BY total_clicks DESC
  LIMIT 500;
$$;

REVOKE ALL ON FUNCTION public.get_contact_conversion_report(integer, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_contact_conversion_report(integer, uuid) TO authenticated;
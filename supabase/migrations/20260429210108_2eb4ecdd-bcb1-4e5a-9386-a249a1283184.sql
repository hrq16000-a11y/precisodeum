-- 1) Tabela de relatórios de integridade
CREATE TABLE IF NOT EXISTS public.integrity_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scope TEXT NOT NULL,
  finding_count INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrity_reports_ran_at ON public.integrity_reports(ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_integrity_reports_scope ON public.integrity_reports(scope);

ALTER TABLE public.integrity_reports ENABLE ROW LEVEL SECURITY;

-- Apenas admins leem
DROP POLICY IF EXISTS "admins read integrity reports" ON public.integrity_reports;
CREATE POLICY "admins read integrity reports"
  ON public.integrity_reports FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Função que executa as validações
CREATE OR REPLACE FUNCTION public.run_integrity_check()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_providers_no_services INT;
  v_services_no_category INT;
  v_providers_null_city INT;
  v_providers_null_neighborhood INT;
  v_services_null_name INT;
  v_total INT;
  v_details JSONB;
BEGIN
  SELECT COUNT(*) INTO v_providers_no_services
  FROM public.providers p
  WHERE NOT EXISTS (SELECT 1 FROM public.services s WHERE s.provider_id = p.id);

  SELECT COUNT(*) INTO v_services_no_category
  FROM public.services
  WHERE category_id IS NULL;

  SELECT COUNT(*) INTO v_providers_null_city
  FROM public.providers
  WHERE city IS NULL OR btrim(city) = '';

  SELECT COUNT(*) INTO v_providers_null_neighborhood
  FROM public.providers
  WHERE neighborhood IS NULL OR btrim(neighborhood) = '';

  SELECT COUNT(*) INTO v_services_null_name
  FROM public.services
  WHERE service_name IS NULL OR btrim(service_name) = '';

  v_total := v_providers_no_services + v_services_no_category +
             v_providers_null_city + v_providers_null_neighborhood +
             v_services_null_name;

  v_details := jsonb_build_object(
    'providers_without_services', v_providers_no_services,
    'services_without_category', v_services_no_category,
    'providers_null_city', v_providers_null_city,
    'providers_null_neighborhood', v_providers_null_neighborhood,
    'services_null_name', v_services_null_name
  );

  INSERT INTO public.integrity_reports (scope, finding_count, details)
  VALUES ('daily', v_total, v_details);

  RETURN v_details;
END;
$$;

-- 3) Agenda diária às 03:00 (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('daily-integrity-check');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'daily-integrity-check',
  '0 3 * * *',
  $$ SELECT public.run_integrity_check(); $$
);

-- Executa uma vez agora para popular o histórico
SELECT public.run_integrity_check();
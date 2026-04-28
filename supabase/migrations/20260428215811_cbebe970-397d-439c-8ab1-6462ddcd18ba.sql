CREATE TABLE IF NOT EXISTS public.service_area_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  triggered_by text NOT NULL DEFAULT 'cron',
  dry_run boolean NOT NULL DEFAULT false,
  affected_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  error_message text,
  timezone text,
  triggered_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_area_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read sync runs"
  ON public.service_area_sync_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_sasr_started_at ON public.service_area_sync_runs (started_at DESC);

CREATE OR REPLACE FUNCTION public.admin_sync_provider_city_with_services(
  p_dry_run boolean DEFAULT false,
  p_triggered_by text DEFAULT 'admin_manual',
  p_timezone text DEFAULT NULL
)
RETURNS TABLE(service_id uuid, provider_id uuid, before_value text, after_value text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r RECORD;
  v_run_id uuid;
  v_count int := 0;
  v_is_admin boolean;
BEGIN
  v_is_admin := public.has_role(auth.uid(), 'admin');
  IF NOT v_is_admin AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.service_area_sync_runs (triggered_by, dry_run, status, timezone, triggered_user_id)
  VALUES (COALESCE(p_triggered_by, 'admin_manual'), p_dry_run, 'running', p_timezone, auth.uid())
  RETURNING id INTO v_run_id;

  BEGIN
    FOR r IN
      SELECT s.id AS sid, s.provider_id AS pid, s.service_area AS sa, p.city AS pc
      FROM public.services s
      JOIN public.providers p ON p.id = s.provider_id
      WHERE p.city IS NOT NULL
        AND length(trim(p.city)) > 0
        AND (
          s.service_area IS NULL
          OR lower(trim(s.service_area)) <> lower(trim(p.city))
        )
    LOOP
      v_count := v_count + 1;
      IF NOT p_dry_run THEN
        INSERT INTO public.service_area_corrections (
          service_id, provider_id, previous_value, new_value,
          reason, source, corrected_by
        ) VALUES (
          r.sid, r.pid, COALESCE(r.sa, '(vazio)'), r.pc,
          'periodic_sync_autofix', COALESCE(p_triggered_by, 'admin_manual'), auth.uid()
        );
        UPDATE public.services SET service_area = r.pc WHERE id = r.sid;
      END IF;

      service_id := r.sid; provider_id := r.pid;
      before_value := r.sa; after_value := r.pc;
      RETURN NEXT;
    END LOOP;

    UPDATE public.service_area_sync_runs
       SET finished_at = now(), affected_count = v_count, status = 'completed'
     WHERE id = v_run_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.service_area_sync_runs
       SET finished_at = now(), status = 'failed', error_message = SQLERRM
     WHERE id = v_run_id;
    RAISE;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_sync_provider_city_with_services(boolean, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_sync_provider_city_with_services(boolean, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_list_service_area_sync_runs(p_limit int DEFAULT 50)
RETURNS SETOF public.service_area_sync_runs
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.service_area_sync_runs
   WHERE public.has_role(auth.uid(), 'admin')
   ORDER BY started_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 500));
$$;

REVOKE ALL ON FUNCTION public.admin_list_service_area_sync_runs(int) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_service_area_sync_runs(int) TO authenticated;

INSERT INTO public.site_settings (key, value, description)
VALUES (
  'service_area_sync_timezone',
  to_jsonb('America/Sao_Paulo'::text),
  'Timezone exibida para o job diário de sincronização provider.city <-> services (cron roda em UTC).'
)
ON CONFLICT (key) DO NOTHING;
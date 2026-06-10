
-- =============================================================
-- 1) Revoke EXECUTE on admin_*/staff_* SECURITY DEFINER funcs from anon
-- =============================================================
DO $$
DECLARE
  r record;
  sig text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND (
        p.proname LIKE 'admin\_%' ESCAPE '\'
        OR p.proname LIKE 'staff\_%' ESCAPE '\'
        OR p.proname IN (
          'guard_staff_role',
          'detect_onboarding_regressions',
          'evaluate_onboarding_experiments_kill_switch',
          'run_integrity_check',
          'refresh_sponsor_billing_status'
        )
      )
  LOOP
    sig := format('public.%I(%s)', r.proname, r.args);
    BEGIN
      EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || sig || ' FROM anon';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip revoke %: %', sig, SQLERRM;
    END;
    BEGIN
      EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || sig || ' FROM public';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || sig || ' TO authenticated';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || sig || ' TO service_role';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- =============================================================
-- 2) RLS drift alerts table
-- =============================================================
CREATE TABLE IF NOT EXISTS public.rls_drift_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL,                  -- policy_added | policy_removed | policy_changed | grant_added | grant_removed | secdef_added | secdef_removed
  object_kind text NOT NULL,               -- table | function
  object_name text NOT NULL,
  role_name text,
  before_state jsonb,
  after_state jsonb,
  severity text NOT NULL DEFAULT 'medium', -- low | medium | high
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  notes text
);

GRANT SELECT, UPDATE ON public.rls_drift_alerts TO authenticated;
GRANT ALL ON public.rls_drift_alerts TO service_role;

ALTER TABLE public.rls_drift_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin read rls drift" ON public.rls_drift_alerts;
CREATE POLICY "admin read rls drift" ON public.rls_drift_alerts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin update rls drift" ON public.rls_drift_alerts;
CREATE POLICY "admin update rls drift" ON public.rls_drift_alerts
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_rls_drift_alerts_detected_at
  ON public.rls_drift_alerts(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_rls_drift_alerts_unack
  ON public.rls_drift_alerts(acknowledged, detected_at DESC)
  WHERE acknowledged = false;

-- =============================================================
-- 3) capture_rls_drift() — diffs against last rls_policy_snapshots row
-- =============================================================
CREATE OR REPLACE FUNCTION public.capture_rls_drift()
RETURNS TABLE(new_alerts integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_current jsonb;
  v_previous jsonb;
  v_new_count integer := 0;
  v_admin_ids uuid[];
BEGIN
  -- Build current policy fingerprint
  SELECT jsonb_build_object(
    'policies', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'schema', schemaname, 'table', tablename, 'policy', policyname,
        'cmd', cmd, 'roles', roles::text, 'qual', qual, 'with_check', with_check
      ) ORDER BY schemaname, tablename, policyname), '[]'::jsonb)
      FROM pg_policies WHERE schemaname = 'public'
    ),
    'secdef_funcs', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', p.proname,
        'args', pg_get_function_identity_arguments(p.oid),
        'anon_can_exec', has_function_privilege('anon', p.oid, 'EXECUTE')
      ) ORDER BY p.proname), '[]'::jsonb)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef = true
    )
  ) INTO v_current;

  -- Get most recent snapshot
  SELECT snapshot_data INTO v_previous
  FROM public.rls_policy_snapshots
  ORDER BY captured_at DESC
  LIMIT 1;

  -- Diff: detect new SECURITY DEFINER funcs that became callable by anon
  IF v_previous IS NOT NULL THEN
    WITH cur AS (
      SELECT (e->>'name') AS name, (e->>'args') AS args,
             (e->>'anon_can_exec')::boolean AS anon_exec
      FROM jsonb_array_elements(v_current->'secdef_funcs') e
    ),
    prev AS (
      SELECT (e->>'name') AS name, (e->>'args') AS args,
             (e->>'anon_can_exec')::boolean AS anon_exec
      FROM jsonb_array_elements(COALESCE(v_previous->'secdef_funcs', '[]'::jsonb)) e
    )
    INSERT INTO public.rls_drift_alerts(category, object_kind, object_name, role_name, before_state, after_state, severity)
    SELECT 'grant_added', 'function', c.name || '(' || c.args || ')', 'anon',
           jsonb_build_object('anon_can_exec', p.anon_exec),
           jsonb_build_object('anon_can_exec', c.anon_exec),
           'high'
    FROM cur c
    LEFT JOIN prev p ON p.name = c.name AND p.args = c.args
    WHERE c.anon_exec = true AND COALESCE(p.anon_exec, false) = false
      AND (c.name LIKE 'admin\_%' ESCAPE '\' OR c.name LIKE 'staff\_%' ESCAPE '\');

    GET DIAGNOSTICS v_new_count = ROW_COUNT;

    -- Policy removals
    WITH cur AS (
      SELECT (e->>'schema')||'.'||(e->>'table')||'.'||(e->>'policy') AS key
      FROM jsonb_array_elements(v_current->'policies') e
    ),
    prev AS (
      SELECT (e->>'schema')||'.'||(e->>'table')||'.'||(e->>'policy') AS key,
             e AS detail
      FROM jsonb_array_elements(COALESCE(v_previous->'policies','[]'::jsonb)) e
    )
    INSERT INTO public.rls_drift_alerts(category, object_kind, object_name, before_state, severity)
    SELECT 'policy_removed', 'table', p.key, p.detail, 'high'
    FROM prev p
    WHERE NOT EXISTS (SELECT 1 FROM cur c WHERE c.key = p.key);
  END IF;

  -- Persist new snapshot
  INSERT INTO public.rls_policy_snapshots(captured_at, snapshot_data, source)
  VALUES (now(), v_current, 'capture_rls_drift');

  -- Notify admins if there are unack alerts
  IF v_new_count > 0 THEN
    SELECT array_agg(user_id) INTO v_admin_ids
    FROM public.user_roles WHERE role = 'admin';

    IF v_admin_ids IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, type, title, message, link)
      SELECT unnest(v_admin_ids), 'security_drift',
             'Drift de segurança detectado',
             format('%s nova(s) alerta(s) de RLS/grant. Veja /admin/security-findings', v_new_count),
             '/admin/security-findings';
    END IF;
  END IF;

  RETURN QUERY SELECT v_new_count;
END $fn$;

REVOKE EXECUTE ON FUNCTION public.capture_rls_drift() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.capture_rls_drift() TO service_role;

-- =============================================================
-- 4) Schedule daily at 04:00 UTC
-- =============================================================
DO $$
BEGIN
  PERFORM cron.unschedule('capture-rls-drift-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'capture-rls-drift-daily',
  '0 4 * * *',
  $$ SELECT public.capture_rls_drift(); $$
);

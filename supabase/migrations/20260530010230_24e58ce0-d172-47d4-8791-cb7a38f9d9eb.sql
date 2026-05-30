-- ETAPA 1.B.2 — Revogar anon + authenticated das funções TRIGGER_INTERNAL (SECURITY DEFINER)
-- ETAPA 1.B.1 — Revogar anon das funções AUTHENTICATED_ONLY (que usam auth.uid())
-- Whitelist PUBLIC_ANON preservada na exclusão.

DO $$
DECLARE
  r RECORD;
  cmd TEXT;
  trig_count INT := 0;
  auth_count INT := 0;
BEGIN
  -- 1.B.2: TRIGGER_INTERNAL — revoke anon + authenticated
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname NOT LIKE 'admin_%'
      AND (
        pg_get_functiondef(p.oid) ILIKE '%TG_OP%'
        OR pg_get_functiondef(p.oid) ILIKE '%TG_TABLE_NAME%'
        OR pg_get_functiondef(p.oid) ILIKE '%NEW.%'
        OR pg_get_functiondef(p.oid) ILIKE '%OLD.%'
      )
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  LOOP
    cmd := format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, authenticated;', r.proname, r.args);
    EXECUTE cmd;
    trig_count := trig_count + 1;
  END LOOP;
  RAISE NOTICE '[1.B.2] Revoked anon+authenticated from % TRIGGER_INTERNAL functions', trig_count;

  -- 1.B.1: AUTHENTICATED_ONLY — revoke anon only (preserve authenticated)
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname NOT LIKE 'admin_%'
      AND pg_get_functiondef(p.oid) ILIKE '%auth.uid()%'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND p.proname NOT IN (
        'search_providers',
        'get_featured_providers',
        'get_category_list',
        'get_sponsor_slots',
        'get_web_vitals_weekly_summary'
      )
      -- Skip the trigger functions already revoked above
      AND NOT (
        pg_get_functiondef(p.oid) ILIKE '%TG_OP%'
        OR pg_get_functiondef(p.oid) ILIKE '%TG_TABLE_NAME%'
        OR pg_get_functiondef(p.oid) ILIKE '%NEW.%'
        OR pg_get_functiondef(p.oid) ILIKE '%OLD.%'
      )
  LOOP
    cmd := format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon;', r.proname, r.args);
    EXECUTE cmd;
    auth_count := auth_count + 1;
  END LOOP;
  RAISE NOTICE '[1.B.1] Revoked anon from % AUTHENTICATED_ONLY functions', auth_count;
END $$;
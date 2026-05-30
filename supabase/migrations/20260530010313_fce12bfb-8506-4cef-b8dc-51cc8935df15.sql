DO $$
DECLARE
  r RECORD;
  trig_count INT := 0;
  auth_count INT := 0;
BEGIN
  -- 1.B.2: TRIGGER_INTERNAL — revoke PUBLIC + anon + authenticated
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
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated;', r.proname, r.args);
    trig_count := trig_count + 1;
  END LOOP;
  RAISE NOTICE '[1.B.2] Revoked PUBLIC+anon+authenticated from % TRIGGER_INTERNAL functions', trig_count;

  -- 1.B.1: AUTHENTICATED_ONLY — revoke PUBLIC + anon, then GRANT back to authenticated
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
      AND NOT (
        pg_get_functiondef(p.oid) ILIKE '%TG_OP%'
        OR pg_get_functiondef(p.oid) ILIKE '%TG_TABLE_NAME%'
        OR pg_get_functiondef(p.oid) ILIKE '%NEW.%'
        OR pg_get_functiondef(p.oid) ILIKE '%OLD.%'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon;', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated;', r.proname, r.args);
    auth_count := auth_count + 1;
  END LOOP;
  RAISE NOTICE '[1.B.1] Revoked PUBLIC+anon (kept authenticated) from % AUTHENTICATED_ONLY functions', auth_count;
END $$;
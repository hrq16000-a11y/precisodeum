DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'admin_%'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE') = true
  LOOP
    -- Preserva acesso de usuários autenticados (admins) antes de revogar PUBLIC
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated;', r.proname, r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC;',     r.proname, r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon;',       r.proname, r.args);
  END LOOP;
END $$;

DO $$
DECLARE remaining int;
BEGIN
  SELECT count(*) INTO remaining
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname LIKE 'admin_%' AND p.prosecdef=true
    AND has_function_privilege('anon', p.oid, 'EXECUTE')=true;
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'ETAPA 1.A falhou: % funções admin_* ainda expostas a anon', remaining;
  END IF;
END $$;
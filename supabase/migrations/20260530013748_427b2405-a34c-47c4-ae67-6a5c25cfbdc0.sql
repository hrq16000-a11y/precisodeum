-- ETAPA 1.B.3 (modo seguro): revogar EXECUTE de PUBLIC e anon nas 49 funções
-- SECURITY DEFINER classificadas como ADMIN_ONLY sem prefixo admin_.
-- Mantém grant para 'authenticated' para não quebrar funções que validam
-- ownership via auth.uid() (award_engagement_points, complete_referral,
-- get_lead_stats, get_sponsor_*, sponsor_*, list_sponsor_invoices, etc.).
-- Exceção: has_role (verificador de papel usado por todas as outras).

DO $$
DECLARE
  r RECORD;
  v_count_total integer := 0;
  v_count_anon  integer := 0;
BEGIN
  FOR r IN
    SELECT
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args,
      has_function_privilege('anon', p.oid, 'EXECUTE') AS had_anon
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname   = 'public'
      AND p.prosecdef = true
      AND p.proname   NOT LIKE 'admin_%'
      AND (
        pg_get_functiondef(p.oid) ILIKE '%has_role%'
        OR pg_get_functiondef(p.oid) ILIKE '%raise%forbidden%'
        OR pg_get_functiondef(p.oid) ILIKE '%raise%unauthorized%'
        OR pg_get_functiondef(p.oid) ILIKE '%raise%not authorized%'
      )
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE') = true
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE') = true
      )
      AND p.proname NOT IN ('has_role')
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
      r.proname, r.args
    );
    v_count_total := v_count_total + 1;
    IF r.had_anon THEN
      v_count_anon := v_count_anon + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'ETAPA 1.B.3 (safe): revoked from PUBLIC+anon on % functions (% had anon=yes)',
    v_count_total, v_count_anon;
END $$;
-- Fix: por default Postgres concede EXECUTE a PUBLIC. REVOKE de anon/authenticated
-- é no-op enquanto PUBLIC tiver acesso. Solução cirúrgica: REVOKE FROM PUBLIC e
-- re-GRANT explícito apenas aos roles desejados.

-- 🔴 CRÍTICAS — apenas service_role (triggers SECURITY DEFINER rodam como owner, não precisam de grant)
REVOKE EXECUTE ON FUNCTION public.calc_provider_avg_response(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.calc_provider_avg_response(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.calculate_user_level(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.calculate_user_level(uuid) TO service_role;

-- 🟠🟡🟢 OUTRAS — authenticated + service_role; bloquear anon
REVOKE EXECUTE ON FUNCTION public.get_contact_impact_24h(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_contact_impact_24h(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.effective_user_permissions(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.effective_user_permissions(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_demand_signal(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_demand_signal(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_profile_completeness(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_profile_completeness(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_profile_health_score(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_profile_health_score(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.derive_provider_primary_category(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.derive_provider_primary_category(uuid) TO authenticated, service_role;
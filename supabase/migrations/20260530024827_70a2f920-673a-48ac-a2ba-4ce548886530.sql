-- ETAPA 1.C: Revogar acesso público (anon) das RPCs com risco de IDOR.
-- Subset de risco real: 8 funções SECURITY DEFINER sem gate de auth.uid().
--
-- Estratégia cirúrgica:
--   • CRÍTICAS (2): chamadas apenas por triggers SECURITY DEFINER (rodam como owner)
--     → REVOKE de anon E authenticated.
--   • OUTRAS (6): podem ter call sites externos futuros / são chamadas com
--     user.id do próprio caller no frontend autenticado
--     → REVOKE apenas de anon. Authenticated mantém acesso.
--
-- Auditoria de call sites confirmou:
--   - get_profile_health_score / get_demand_signal / get_contact_impact_24h:
--     chamados pelo frontend autenticado (passam user.id próprio). Manter authenticated.
--   - effective_user_permissions / get_profile_completeness /
--     derive_provider_primary_category / calc_provider_avg_response /
--     calculate_user_level: sem call sites no frontend nem edge functions.

-- 🔴 CRÍTICAS — revogar de anon e authenticated
REVOKE EXECUTE ON FUNCTION public.calc_provider_avg_response(_provider_id uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_user_level(_user_id uuid) FROM anon, authenticated;

-- 🟠🟡🟢 OUTRAS — revogar apenas de anon
REVOKE EXECUTE ON FUNCTION public.get_contact_impact_24h(_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.effective_user_permissions(_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_demand_signal(_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_profile_completeness(_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_profile_health_score(_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.derive_provider_primary_category(_provider_id uuid) FROM anon;

-- service_role e postgres mantêm EXECUTE (default). Triggers SECURITY DEFINER
-- continuam funcionando porque rodam como owner da função.
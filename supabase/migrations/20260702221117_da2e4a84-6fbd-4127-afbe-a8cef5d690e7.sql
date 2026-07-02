-- S-01 Wave 1: REVOKE EXECUTE em funções SECURITY DEFINER internas
-- Escopo: somente revokes. Nenhuma outra alteração.
-- 4 funções candidatas foram removidas por uso client-side real:
--   upload_failure_stats, evaluate_onboarding_auto_response,
--   audit_user_ref_full, log_sponsor_doc_validation_failure

BEGIN;

-- 1. Triggers e utilitários internos
REVOKE EXECUTE ON FUNCTION public._sync_in_progress()                        FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_audit_log_tampering()              FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.health_check_history_autoclean()           FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restrict_anon_lead_update()                FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_restrict_anon_sponsor_lead_update() FROM public, anon, authenticated;

-- 2. Cron jobs (pg_cron / edge com service_role)
REVOKE EXECUTE ON FUNCTION public.process_daily_stats()                      FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_cold_storage_91d()                   FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_registration_blocks_180d()          FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_all_sponsor_pacing()               FROM public, anon, authenticated;

-- 3. Notificações internas / risco de spam
REVOKE EXECUTE ON FUNCTION public.notify_admins_about_sponsor(uuid,text,text,text,text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins_geo_alert(text,text,text,text)          FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_sponsor_contacts(uuid,text,text,text)          FROM public, anon, authenticated;

-- 4. Logging interno / risco de poluição de base
REVOKE EXECUTE ON FUNCTION public.log_provider_geo_issue(uuid,text,text,text,text,jsonb,uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_provider_geo_source(uuid,text,numeric,jsonb,text,text,text,uuid) FROM public, anon, authenticated;

-- 5. Recálculos pesados / risco de DoS
REVOKE EXECUTE ON FUNCTION public.recalculate_engagement_points(uuid)         FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_provider_community_verified(uuid)    FROM public, anon, authenticated;

-- 6. Rate-limit bump (escrita, uso apenas edge/service_role)
REVOKE EXECUTE ON FUNCTION public.bump_auth_rate_limit(text,text,text,boolean,integer,integer,integer) FROM public, anon, authenticated;

-- 7. Admin / jobs internos
REVOKE EXECUTE ON FUNCTION public.find_orphan_media(integer)                  FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_sponsor_cycle_amount(uuid)          FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_rss_import_headers()                    FROM public, anon, authenticated;

COMMIT;
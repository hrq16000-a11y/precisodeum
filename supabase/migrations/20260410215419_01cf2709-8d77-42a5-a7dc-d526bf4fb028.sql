
ALTER VIEW IF EXISTS public.public_profiles SET (security_invoker = true);
ALTER VIEW IF EXISTS public.account_model_view SET (security_invoker = true);
ALTER VIEW IF EXISTS public.account_limits_view SET (security_invoker = true);
ALTER VIEW IF EXISTS public.user_master_view SET (security_invoker = true);
ALTER VIEW IF EXISTS public.export_users SET (security_invoker = true);
ALTER VIEW IF EXISTS public.city_provider_stats SET (security_invoker = true);
ALTER VIEW IF EXISTS public.public_jobs SET (security_invoker = true);
ALTER VIEW IF EXISTS public.public_user_levels SET (security_invoker = true);

-- Prevent API roles from calling a SECURITY DEFINER function that reads Vault.
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default unless revoked.
REVOKE ALL ON FUNCTION public.get_rss_import_headers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_rss_import_headers() FROM anon;
REVOKE ALL ON FUNCTION public.get_rss_import_headers() FROM authenticated;

-- Keep execution limited to trusted server-side roles used by cron/maintenance.
GRANT EXECUTE ON FUNCTION public.get_rss_import_headers() TO postgres;
GRANT EXECUTE ON FUNCTION public.get_rss_import_headers() TO service_role;

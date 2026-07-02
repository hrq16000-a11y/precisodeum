-- B2: Revoke direct access to featured_providers_mv from API roles.
-- Frontend already uses RPC public.get_featured_providers (SECURITY DEFINER),
-- so revoking direct SELECT does not break the UI.
REVOKE ALL ON public.featured_providers_mv FROM anon, authenticated, PUBLIC;
-- Keep service_role SELECT for admin tooling / cron refresh paths.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.featured_providers_mv FROM service_role;
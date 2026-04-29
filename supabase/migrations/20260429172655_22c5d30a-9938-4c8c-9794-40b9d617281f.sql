REVOKE ALL ON FUNCTION public.bump_auth_rate_limit(text, text, text, boolean, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.peek_auth_rate_limit(text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.bump_auth_rate_limit(text, text, text, boolean, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.peek_auth_rate_limit(text, text, text) TO service_role;
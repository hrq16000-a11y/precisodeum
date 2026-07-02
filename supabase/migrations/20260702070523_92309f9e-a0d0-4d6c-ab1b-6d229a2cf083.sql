-- Fix: restore public read access to columns needed by public profile pages.
-- Hardening migration 20260610051151 whitelisted anon SELECT on providers but
-- omitted `ibge_code` (used by /profissional/:slug) and `legal_name`
-- (used by /empresa/:slug). PostgREST returned "permission denied for column",
-- the client swallowed the error and the pages fell back to "not found",
-- breaking SEO on thousands of canonical URLs.
--
-- Both columns are non-sensitive:
--   - ibge_code: public IBGE municipal code
--   - legal_name: razão social (already public on company pages by design)

GRANT SELECT (ibge_code, legal_name) ON public.providers TO anon;
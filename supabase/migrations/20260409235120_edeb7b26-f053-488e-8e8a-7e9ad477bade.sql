
DROP VIEW IF EXISTS public.city_provider_stats;
CREATE VIEW public.city_provider_stats WITH (security_invoker = true) AS
SELECT 
  c.id as city_id,
  c.name as city_name,
  c.slug as city_slug,
  c.state_uf,
  COUNT(p.id) FILTER (WHERE p.status = 'approved' AND p.deleted_at IS NULL) as providers_count,
  COUNT(p.id) FILTER (WHERE p.status = 'approved' AND p.deleted_at IS NULL) > 0 as has_active_providers
FROM public.cities c
LEFT JOIN public.providers p ON UPPER(TRIM(p.city)) = UPPER(TRIM(c.name)) 
  AND UPPER(TRIM(p.state)) = c.state_uf
GROUP BY c.id, c.name, c.slug, c.state_uf;

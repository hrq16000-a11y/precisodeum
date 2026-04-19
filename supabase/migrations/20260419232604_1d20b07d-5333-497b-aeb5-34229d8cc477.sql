CREATE OR REPLACE FUNCTION public.get_home_bootstrap()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_top_cities jsonb;
  v_sponsors jsonb;
  v_services_count integer;
  v_jobs_count integer;
BEGIN
  -- Top 6 cidades com profissionais
  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_top_cities
  FROM (
    SELECT name, slug, state
    FROM public.cities
    WHERE has_providers = true
    ORDER BY provider_count DESC
    LIMIT 6
  ) x;

  -- Patrocinadores ativos
  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_sponsors
  FROM (
    SELECT id, title, company_name, image_url, logo_url, link_url,
           tier, position, active, display_order, short_description,
           max_width, max_height
    FROM public.sponsors
    WHERE active = true
    ORDER BY display_order ASC
  ) x;

  -- Contagens
  SELECT COUNT(*) INTO v_services_count FROM public.services WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO v_jobs_count FROM public.jobs WHERE status = 'active' AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'topCities', v_top_cities,
    'sponsors', v_sponsors,
    'counts', jsonb_build_object(
      'services', v_services_count,
      'jobs', v_jobs_count
    ),
    'generated_at', now()
  );
END;
$$;

-- Permitir execução pública (dados já são públicos no site)
GRANT EXECUTE ON FUNCTION public.get_home_bootstrap() TO anon, authenticated;
-- 1) Materialized View dos profissionais aprovados em destaque
DROP MATERIALIZED VIEW IF EXISTS public.featured_providers_mv;

CREATE MATERIALIZED VIEW public.featured_providers_mv AS
SELECT
  p.id,
  p.user_id,
  p.user_ref,
  p.slug,
  p.business_name,
  p.description,
  p.photo_url,
  p.city,
  p.state,
  p.neighborhood,
  p.phone,
  p.whatsapp,
  p.latitude,
  p.longitude,
  p.years_experience,
  p.plan,
  p.featured,
  p.rating_avg,
  p.review_count,
  p.services_count,
  p.portfolio_album_count,
  p.portfolio_photo_count,
  p.created_at,
  p.category_id,
  c.name AS category_name,
  c.slug AS category_slug,
  c.icon AS category_icon
FROM public.providers p
LEFT JOIN public.categories c ON c.id = p.category_id
WHERE p.status = 'approved'
  AND p.deleted_at IS NULL
  AND p.featured = true
ORDER BY
  COALESCE(p.rating_avg, 0) DESC,
  COALESCE(p.review_count, 0) DESC,
  p.created_at DESC;

-- Índice único obrigatório para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS featured_providers_mv_id_idx
  ON public.featured_providers_mv (id);

-- Índices auxiliares para filtros comuns
CREATE INDEX IF NOT EXISTS featured_providers_mv_category_idx
  ON public.featured_providers_mv (category_slug);
CREATE INDEX IF NOT EXISTS featured_providers_mv_city_idx
  ON public.featured_providers_mv (city);

-- Permissões de leitura pública (dados já visíveis no site)
GRANT SELECT ON public.featured_providers_mv TO anon, authenticated;

-- 2) Função de refresh (CONCURRENTLY = não bloqueia leituras)
CREATE OR REPLACE FUNCTION public.refresh_featured_providers_mv()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.featured_providers_mv;
EXCEPTION WHEN OTHERS THEN
  -- Fallback não-concorrente caso o índice único ainda não esteja pronto
  REFRESH MATERIALIZED VIEW public.featured_providers_mv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_featured_providers_mv() TO authenticated;

-- 3) Garante extensão pg_cron habilitada (esquema dedicado)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 4) Agenda refresh a cada 15 minutos (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-featured-providers-mv');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'refresh-featured-providers-mv',
  '*/15 * * * *',
  $$ SELECT public.refresh_featured_providers_mv(); $$
);
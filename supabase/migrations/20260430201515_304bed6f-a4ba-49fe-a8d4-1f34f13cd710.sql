-- ============================================================================
-- Otimização de índices — Velocidade de queries em escala (v3)
-- Correções: services não tem is_active (usa deleted_at IS NULL);
-- catálogo de categorias é `categories` (não service_categories);
-- adiciono também índice em service_categories(category_id) para lookups
-- reversos (categoria → serviços).
-- ============================================================================

-- 1) ONBOARDING_EVENTS — GIN em meta (JSONB)
CREATE INDEX IF NOT EXISTS idx_onboarding_events_meta_gin
  ON public.onboarding_events
  USING gin (meta jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_phase_created
  ON public.onboarding_events (phase, created_at DESC);

-- 2) SERVICES — joins/filtros usando soft delete
CREATE INDEX IF NOT EXISTS idx_services_category_active
  ON public.services (category_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_services_provider_active
  ON public.services (provider_id)
  WHERE deleted_at IS NULL;

-- 2b) SERVICE_CATEGORIES (junção) — lookup reverso por categoria
CREATE INDEX IF NOT EXISTS idx_service_categories_category
  ON public.service_categories (category_id);

-- 3) PROVIDERS — listagem padrão (status + soft delete)
CREATE INDEX IF NOT EXISTS idx_providers_status_active
  ON public.providers (status)
  WHERE deleted_at IS NULL;

-- 4) ÍNDICES FUNCIONAIS LOWER() — prefixo case-insensitive (ILIKE 'pref%')
CREATE INDEX IF NOT EXISTS idx_cities_name_lower
  ON public.cities (LOWER(name) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_providers_city_lower
  ON public.providers (LOWER(city) text_pattern_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_providers_neighborhood_lower
  ON public.providers (LOWER(neighborhood) text_pattern_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_services_name_lower
  ON public.services (LOWER(service_name) text_pattern_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_name_lower
  ON public.categories (LOWER(name) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_jobs_title_lower
  ON public.jobs (LOWER(title) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_jobs_city_lower
  ON public.jobs (LOWER(city) text_pattern_ops);

-- 5) PG_TRGM — ILIKE '%termo%' (curinga em ambos os lados)
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_cities_name_trgm
  ON public.cities
  USING gin (name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_providers_city_trgm
  ON public.providers
  USING gin (city extensions.gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_services_name_trgm
  ON public.services
  USING gin (service_name extensions.gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm
  ON public.jobs
  USING gin (title extensions.gin_trgm_ops);

-- 6) ANALYZE para o planner aproveitar imediatamente
ANALYZE public.onboarding_events;
ANALYZE public.services;
ANALYZE public.service_categories;
ANALYZE public.providers;
ANALYZE public.cities;
ANALYZE public.categories;
ANALYZE public.jobs;

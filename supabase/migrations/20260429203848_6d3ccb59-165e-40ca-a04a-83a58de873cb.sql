-- 1) Categoria fallback
INSERT INTO public.categories (id, slug, name)
SELECT gen_random_uuid(), 'outros-servicos', 'Outros serviços'
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'outros-servicos');

-- 2) Backfill via junção
UPDATE public.services s
SET category_id = sub.category_id
FROM (
  SELECT DISTINCT ON (service_id) service_id, category_id
  FROM public.service_categories
  ORDER BY service_id, id
) sub
WHERE s.category_id IS NULL AND s.id = sub.service_id;

-- 3) Fallback "Outros serviços" para os restantes
UPDATE public.services
SET category_id = (SELECT id FROM public.categories WHERE slug = 'outros-servicos' LIMIT 1)
WHERE category_id IS NULL;

-- 4) Bairro padrão para prestadores antigos com cidade
UPDATE public.providers
SET neighborhood = 'Centro'
WHERE (neighborhood IS NULL OR neighborhood = '')
  AND city IS NOT NULL AND city <> '';

-- 5) Index para busca filtrada por categoria
CREATE INDEX IF NOT EXISTS idx_services_category_id ON public.services(category_id) WHERE deleted_at IS NULL;
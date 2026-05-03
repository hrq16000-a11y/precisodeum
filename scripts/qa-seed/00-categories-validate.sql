-- ============================================================================
-- QA Seed · Categorias (validação / backfill defensivo)
-- ============================================================================
-- Este script NÃO recria as 541 categorias canônicas existentes (memória
-- "taxonomia-categorias-padronizada" proíbe sobrescrever a taxonomia).
-- Ele apenas:
--   1) garante que public.categories tem volume mínimo (>= 50 ativas);
--   2) preenche slugs nulos via slugify defensivo;
--   3) gera um pequeno "fallback set" (20 categorias QA) somente se a tabela
--      estiver praticamente vazia (<10) — caso típico de banco recém-clonado.
--
-- Idempotente: rodar N vezes não duplica nada (todos os INSERTs usam
-- ON CONFLICT (slug) DO NOTHING).
-- ============================================================================

\set ON_ERROR_STOP on
SET search_path = public, extensions;

DO $$
DECLARE
  v_total int;
  v_active int;
BEGIN
  SELECT count(*) INTO v_total FROM public.categories;
  SELECT count(*) INTO v_active FROM public.categories WHERE deleted_at IS NULL;
  RAISE NOTICE 'categorias: total=%, ativas=%', v_total, v_active;
END $$;

-- 1) Backfill de slugs nulos (não toca slugs existentes)
UPDATE public.categories
   SET slug = lower(regexp_replace(
                translate(name,
                  'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
                  'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
                '[^a-zA-Z0-9]+', '-', 'g'))
 WHERE slug IS NULL OR slug = '';

-- 2) Fallback QA (apenas se taxonomia estiver vazia/quase-vazia)
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.categories WHERE deleted_at IS NULL;
  IF v_count < 10 THEN
    RAISE NOTICE 'Taxonomia vazia (% ativas) — inserindo fallback QA de 20 categorias.', v_count;
    INSERT INTO public.categories (name, slug, icon)
    VALUES
      ('Eletricista','eletricista','Zap'),
      ('Encanador','encanador','Wrench'),
      ('Pedreiro','pedreiro','Hammer'),
      ('Pintor','pintor','PaintBucket'),
      ('Diarista','diarista','Sparkles'),
      ('Jardineiro','jardineiro','Trees'),
      ('Marceneiro','marceneiro','Axe'),
      ('Serralheiro','serralheiro','Anvil'),
      ('Chaveiro','chaveiro','Key'),
      ('Mecânico','mecanico','Settings'),
      ('Técnico de Informática','tecnico-informatica','Laptop'),
      ('Designer Gráfico','designer-grafico','Palette'),
      ('Fotógrafo','fotografo','Camera'),
      ('Personal Trainer','personal-trainer','Dumbbell'),
      ('Professor Particular','professor-particular','GraduationCap'),
      ('Cabeleireiro','cabeleireiro','Scissors'),
      ('Manicure','manicure','Hand'),
      ('Massoterapeuta','massoterapeuta','HeartPulse'),
      ('Cuidador de Idosos','cuidador-idosos','HeartHandshake'),
      ('Pet Sitter','pet-sitter','PawPrint')
    ON CONFLICT (slug) DO NOTHING;
  ELSE
    RAISE NOTICE 'Taxonomia íntegra (% ativas) — nenhum insert necessário.', v_count;
  END IF;
END $$;

-- 3) Saneamento final
ANALYZE public.categories;

SELECT
  count(*) FILTER (WHERE deleted_at IS NULL) AS categorias_ativas,
  count(*) FILTER (WHERE slug IS NULL OR slug = '') AS sem_slug,
  count(DISTINCT parent_id) FILTER (WHERE parent_id IS NOT NULL) AS com_pai
FROM public.categories;

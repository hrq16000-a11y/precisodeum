-- =====================================================================
-- 1) services.category_id NOT NULL + FK ON DELETE RESTRICT
-- =====================================================================

-- 1a) Sanitização preventiva: se houver algum serviço sem categoria,
--     atribui à categoria "Outros serviços" (slug = 'outros-servicos').
--     Hoje (auditoria pré-migração) não há nulos, mas mantemos o bloco
--     idempotente para resistir a inserts legados em janelas de deploy.
DO $$
DECLARE
  v_outros uuid;
  v_nulls  bigint;
BEGIN
  SELECT count(*) INTO v_nulls FROM public.services WHERE category_id IS NULL;

  IF v_nulls > 0 THEN
    SELECT id INTO v_outros
    FROM public.categories
    WHERE slug = 'outros-servicos'
    LIMIT 1;

    IF v_outros IS NULL THEN
      RAISE EXCEPTION
        'Existem % serviços sem category_id e a categoria "outros-servicos" não existe. Limpe os dados antes de aplicar esta migração.',
        v_nulls;
    END IF;

    UPDATE public.services
       SET category_id = v_outros
     WHERE category_id IS NULL;

    RAISE NOTICE 'Migração: % serviços sem categoria foram movidos para "Outros serviços".', v_nulls;
  END IF;
END$$;

-- 1b) Aplica NOT NULL (idempotente — só executa se ainda for nullable).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='services'
       AND column_name='category_id' AND is_nullable='YES'
  ) THEN
    ALTER TABLE public.services ALTER COLUMN category_id SET NOT NULL;
  END IF;
END$$;

-- 1c) Garante FK com ON DELETE RESTRICT (1 serviço → 1 categoria; categoria
--     com serviços vinculados não pode ser apagada acidentalmente).
ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_category_id_fkey;

ALTER TABLE public.services
  ADD CONSTRAINT services_category_id_fkey
  FOREIGN KEY (category_id)
  REFERENCES public.categories(id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- Índice de apoio (idempotente).
CREATE INDEX IF NOT EXISTS idx_services_category_id
  ON public.services (category_id);

-- =====================================================================
-- 2) support_tickets.context (JSONB) — contexto estruturado visível ao admin
-- =====================================================================
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_support_tickets_context_source
  ON public.support_tickets ((context->>'source'));

COMMENT ON COLUMN public.support_tickets.context IS
  'Contexto estruturado da solicitação (ex.: {source, services_count, cap, attempted_categories}). Preenchido automaticamente quando o usuário abre o ticket via FAQ/limite de serviços.';

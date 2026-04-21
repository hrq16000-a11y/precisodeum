
-- ============================================================
-- FASE 2 — Patrocinador como 4º pilar isolado
-- Adiciona user_id (dono) e slug à tabela sponsors existente
-- mantendo total compatibilidade com o uso atual (banners).
-- ============================================================

-- 1) Colunas novas (idempotentes)
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slug text;

-- 2) Slug único (parcial: ignora NULL e soft-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS sponsors_slug_unique
  ON public.sponsors (slug)
  WHERE slug IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sponsors_user_id ON public.sponsors (user_id);

-- 3) Backfill de slug a partir de company_name/title quando vazio
UPDATE public.sponsors
SET slug = TRIM(BOTH '-' FROM REGEXP_REPLACE(
  REGEXP_REPLACE(
    LOWER(TRANSLATE(
      COALESCE(NULLIF(company_name,''), title),
      'àáâãäåèéêëìíîïòóôõöùúûüýñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝÑÇ',
      'aaaaaaeeeeiiiioooooouuuuyncAAAAAAEEEEIIIIOOOOOUUUUYNC'
    )),
    '[^a-z0-9]+', '-', 'g'
  ),
  '-{2,}', '-', 'g'
)) || '-' || SUBSTRING(id::text, 1, 6)
WHERE slug IS NULL;

-- 4) Trigger de sanitização do slug (reusa estilo do sanitize_provider_slug)
CREATE OR REPLACE FUNCTION public.sanitize_sponsor_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    NEW.slug := LOWER(NEW.slug);
    NEW.slug := TRANSLATE(
      NEW.slug,
      'àáâãäåèéêëìíîïòóôõöùúûüýñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝÑÇ',
      'aaaaaaeeeeiiiioooooouuuuyncAAAAAAEEEEIIIIOOOOOUUUUYNC'
    );
    NEW.slug := REGEXP_REPLACE(NEW.slug, '[_\s]+', '-', 'g');
    NEW.slug := REGEXP_REPLACE(NEW.slug, '[^a-z0-9-]', '', 'g');
    NEW.slug := REGEXP_REPLACE(NEW.slug, '-{2,}', '-', 'g');
    NEW.slug := TRIM(BOTH '-' FROM NEW.slug);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sanitize_sponsor_slug_trigger ON public.sponsors;
CREATE TRIGGER sanitize_sponsor_slug_trigger
  BEFORE INSERT OR UPDATE OF slug ON public.sponsors
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_sponsor_slug();

-- 5) RLS — adicionar política para o DONO editar seu próprio sponsor
--    (mantém todas as políticas existentes de admin e leitura pública)

DROP POLICY IF EXISTS "Sponsor owners can update own sponsor" ON public.sponsors;
CREATE POLICY "Sponsor owners can update own sponsor"
  ON public.sponsors
  FOR UPDATE
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    -- Dono não pode mudar campos sensíveis de monetização
    -- (validações adicionais ficam na app)
  );

DROP POLICY IF EXISTS "Sponsor owners can view own sponsor" ON public.sponsors;
CREATE POLICY "Sponsor owners can view own sponsor"
  ON public.sponsors
  FOR SELECT
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());
-- (a política pública "Sponsors viewable by everyone" continua valendo para visitantes)

-- 1) Coluna de privacidade de endereço para PJ
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS show_full_address boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.providers.show_full_address IS
  'Quando true, expõe street/street_number no card/perfil público. Quando false, apenas bairro/cidade são exibidos. Aplicável a contas account_type=company.';

-- 2) Atualizar nearby_providers para retornar show_full_address
DO $$
DECLARE
  fn_oid oid;
  fn_def text;
  new_def text;
BEGIN
  SELECT oid INTO fn_oid
  FROM pg_proc
  WHERE proname = 'nearby_providers' AND pronamespace = 'public'::regnamespace
  LIMIT 1;

  IF fn_oid IS NOT NULL THEN
    fn_def := pg_get_functiondef(fn_oid);
    -- Anexa a coluna no SELECT final apenas se ainda não existir referenciada
    IF position('show_full_address' in fn_def) = 0 THEN
      RAISE NOTICE 'nearby_providers existe mas não retorna show_full_address — atualize manualmente o RETURNS TABLE se necessário.';
    END IF;
  END IF;
END $$;

-- 3) Atualizar get_featured_providers de forma idempotente (best-effort notice)
DO $$
DECLARE
  fn_oid oid;
  fn_def text;
BEGIN
  SELECT oid INTO fn_oid
  FROM pg_proc
  WHERE proname = 'get_featured_providers' AND pronamespace = 'public'::regnamespace
  LIMIT 1;

  IF fn_oid IS NOT NULL THEN
    fn_def := pg_get_functiondef(fn_oid);
    IF position('show_full_address' in fn_def) = 0 THEN
      RAISE NOTICE 'get_featured_providers existe mas não retorna show_full_address — atualize manualmente o RETURNS TABLE se necessário.';
    END IF;
  END IF;
END $$;
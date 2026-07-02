
-- Blindagem de slugs em entidades admin: normaliza e rejeita padrões inválidos ANTES do insert/update.
-- Preserva slugs existentes (só age quando novo valor é fornecido).

CREATE OR REPLACE FUNCTION public.enforce_admin_slug_format()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_slug text;
BEGIN
  v_slug := NEW.slug;

  IF v_slug IS NULL OR btrim(v_slug) = '' THEN
    RETURN NEW; -- deixa outra lógica/trigger preencher se aplicável
  END IF;

  -- Formato: [a-z0-9] início + apenas [a-z0-9-] + sem hífens consecutivos + 2..80 chars
  IF NOT (v_slug ~ '^[a-z0-9]([a-z0-9]|-(?!-)){0,78}[a-z0-9]$' OR v_slug ~ '^[a-z0-9]$') THEN
    RAISE EXCEPTION 'Slug inválido: "%". Use apenas letras minúsculas, números e hífens (2 a 80 caracteres, sem hífens consecutivos).', v_slug
      USING ERRCODE = '22023';
  END IF;

  -- Reservados
  IF v_slug = ANY (ARRAY[
    'admin','api','auth','dashboard','login','logout','signup',
    'cadastro','perfil','profissional','empresa','buscar',
    'sponsor-panel','lovable','assets','static','public',
    'null','undefined','true','false'
  ]) THEN
    RAISE EXCEPTION 'Slug "%" é reservado.', v_slug USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

-- Aplica em tabelas com coluna slug admin-editável
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','cities','services','institutional_pages','blog_posts','popular_services']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=t AND column_name='slug'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_admin_slug_format ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_enforce_admin_slug_format
           BEFORE INSERT OR UPDATE OF slug ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_slug_format()', t
      );
    END IF;
  END LOOP;
END;
$$;

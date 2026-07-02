-- 1) Garantir categoria "Outros serviços" idempotente
INSERT INTO public.categories (name, slug, icon)
VALUES ('Outros serviços', 'outros-servicos', 'Archive')
ON CONFLICT (slug) DO NOTHING;

-- 2) Normalização preventiva de ícones vazios para evitar quebra do trigger
UPDATE public.categories
SET icon = 'Archive'
WHERE icon IS NULL OR btrim(icon) = '';

-- 3) Função de validação: bloqueia emojis / não-Lucide em categories.icon
CREATE OR REPLACE FUNCTION public.validate_category_icon_lucide()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.icon IS NULL OR btrim(NEW.icon) = '' THEN
    RAISE EXCEPTION 'category.icon obrigatório (use um nome de ícone Lucide, ex: Archive)';
  END IF;
  -- Apenas PascalCase ASCII (letras/números). Bloqueia emojis e qualquer caractere multibyte.
  IF NEW.icon !~ '^[A-Z][A-Za-z0-9]{1,49}$' THEN
    RAISE EXCEPTION 'category.icon inválido (%): use somente nomes de ícones Lucide em PascalCase, sem emojis', NEW.icon;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_category_icon_lucide ON public.categories;
CREATE TRIGGER trg_validate_category_icon_lucide
BEFORE INSERT OR UPDATE OF icon ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.validate_category_icon_lucide();
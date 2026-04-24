-- Adiciona meta_title / meta_description em services e cria triggers de auto-preenchimento
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text;

-- ===== Função: meta de PROVIDERS =====
CREATE OR REPLACE FUNCTION public.autofill_provider_meta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_name text;
  base_name text;
  loc_str text;
BEGIN
  -- Só preenche se vazio
  IF (NEW.meta_title IS NOT NULL AND length(trim(NEW.meta_title)) > 0)
     AND (NEW.meta_description IS NOT NULL AND length(trim(NEW.meta_description)) > 0) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO cat_name FROM public.categories WHERE id = NEW.category_id;
  base_name := COALESCE(NULLIF(trim(NEW.business_name), ''), COALESCE(cat_name, 'Profissional'));
  loc_str := trim(both ', ' FROM
    COALESCE(NULLIF(NEW.city, ''), '') ||
    CASE WHEN NEW.state IS NOT NULL AND NEW.state <> '' THEN ' - ' || NEW.state ELSE '' END
  );

  IF NEW.meta_title IS NULL OR length(trim(NEW.meta_title)) = 0 THEN
    NEW.meta_title := left(
      base_name ||
      CASE WHEN cat_name IS NOT NULL AND cat_name <> base_name THEN ' · ' || cat_name ELSE '' END ||
      CASE WHEN loc_str <> '' THEN ' em ' || loc_str ELSE '' END,
      60
    );
  END IF;

  IF NEW.meta_description IS NULL OR length(trim(NEW.meta_description)) = 0 THEN
    NEW.meta_description := left(
      COALESCE(NULLIF(trim(NEW.description), ''),
        'Encontre ' || COALESCE(cat_name, 'profissionais qualificados') ||
        CASE WHEN loc_str <> '' THEN ' em ' || loc_str ELSE ' no Brasil' END ||
        '. Solicite orçamento direto pelo WhatsApp.'
      ),
      160
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autofill_provider_meta ON public.providers;
CREATE TRIGGER trg_autofill_provider_meta
BEFORE INSERT OR UPDATE OF business_name, description, city, state, category_id, meta_title, meta_description
ON public.providers
FOR EACH ROW EXECUTE FUNCTION public.autofill_provider_meta();

-- ===== Função: meta de SERVICES =====
CREATE OR REPLACE FUNCTION public.autofill_service_meta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_name text;
  prov_city text;
  prov_state text;
  loc_str text;
BEGIN
  IF (NEW.meta_title IS NOT NULL AND length(trim(NEW.meta_title)) > 0)
     AND (NEW.meta_description IS NOT NULL AND length(trim(NEW.meta_description)) > 0) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO cat_name FROM public.categories WHERE id = NEW.category_id;
  SELECT city, state INTO prov_city, prov_state FROM public.providers WHERE id = NEW.provider_id;
  loc_str := trim(both ', ' FROM
    COALESCE(NULLIF(prov_city, ''), '') ||
    CASE WHEN prov_state IS NOT NULL AND prov_state <> '' THEN ' - ' || prov_state ELSE '' END
  );

  IF NEW.meta_title IS NULL OR length(trim(NEW.meta_title)) = 0 THEN
    NEW.meta_title := left(
      COALESCE(NULLIF(trim(NEW.service_name), ''), COALESCE(cat_name, 'Serviço')) ||
      CASE WHEN loc_str <> '' THEN ' em ' || loc_str ELSE '' END,
      60
    );
  END IF;

  IF NEW.meta_description IS NULL OR length(trim(NEW.meta_description)) = 0 THEN
    NEW.meta_description := left(
      COALESCE(NULLIF(trim(NEW.description), ''),
        'Contrate ' || COALESCE(NULLIF(NEW.service_name,''), cat_name, 'este serviço') ||
        CASE WHEN loc_str <> '' THEN ' em ' || loc_str ELSE '' END ||
        '. Veja preço, área de atendimento e fale direto pelo WhatsApp.'
      ),
      160
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autofill_service_meta ON public.services;
CREATE TRIGGER trg_autofill_service_meta
BEFORE INSERT OR UPDATE OF service_name, description, category_id, meta_title, meta_description
ON public.services
FOR EACH ROW EXECUTE FUNCTION public.autofill_service_meta();

-- Backfill: aplica em registros existentes vazios
UPDATE public.providers SET meta_title = NULL WHERE meta_title IS NULL OR meta_title = '';
UPDATE public.services SET meta_title = NULL WHERE meta_title IS NULL OR meta_title = '';
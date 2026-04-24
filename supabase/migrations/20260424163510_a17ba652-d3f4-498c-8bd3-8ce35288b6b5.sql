-- 1) Função utilitária central: normaliza qualquer entrada para sigla oficial UF (ou NULL)
CREATE OR REPLACE FUNCTION public.normalize_uf(_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
  m_full jsonb := jsonb_build_object(
    'ACRE','AC','ALAGOAS','AL','AMAPA','AP','AMAPÁ','AP','AMAZONAS','AM','BAHIA','BA',
    'CEARA','CE','CEARÁ','CE','DISTRITO FEDERAL','DF','ESPIRITO SANTO','ES','ESPÍRITO SANTO','ES',
    'GOIAS','GO','GOIÁS','GO','MARANHAO','MA','MARANHÃO','MA','MATO GROSSO','MT',
    'MATO GROSSO DO SUL','MS','MINAS GERAIS','MG','PARA','PA','PARÁ','PA','PARAIBA','PB','PARAÍBA','PB',
    'PARANA','PR','PARANÁ','PR','PERNAMBUCO','PE','PIAUI','PI','PIAUÍ','PI',
    'RIO DE JANEIRO','RJ','RIO GRANDE DO NORTE','RN','RIO GRANDE DO SUL','RS',
    'RONDONIA','RO','RONDÔNIA','RO','RORAIMA','RR','SANTA CATARINA','SC',
    'SAO PAULO','SP','SÃO PAULO','SP','SERGIPE','SE','TOCANTINS','TO'
  );
  valid text[] := ARRAY['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
                        'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
BEGIN
  IF _input IS NULL THEN RETURN NULL; END IF;
  v := upper(btrim(_input));
  IF v = '' THEN RETURN NULL; END IF;

  -- Caso direto: já é uma das 27 UFs oficiais
  IF v = ANY(valid) THEN RETURN v; END IF;

  -- Caso nome completo (com ou sem acentos): mapear
  IF m_full ? v THEN RETURN m_full->>v; END IF;

  -- Qualquer outra coisa (ex: "ST", "XX", "Pa", "Paranã") → NULL
  RETURN NULL;
END;
$$;

-- 2) Saneamento dos dados antigos
-- 2a) providers — primeiro tenta inferir pela cidade na tabela cities
UPDATE public.providers p
SET state = c.state_uf
FROM public.cities c
WHERE (p.state IS NULL OR public.normalize_uf(p.state) IS NULL)
  AND c.name = p.city
  AND c.state_uf IS NOT NULL
  AND length(c.state_uf) = 2;

-- 2b) providers — depois normaliza o que sobrou (Paraná → PR, etc.)
UPDATE public.providers
SET state = public.normalize_uf(state)
WHERE state IS NOT NULL AND state <> COALESCE(public.normalize_uf(state), '');

-- 2c) profiles
UPDATE public.profiles p
SET state = c.state_uf
FROM public.cities c
WHERE (p.state IS NULL OR public.normalize_uf(p.state) IS NULL)
  AND c.name = p.city
  AND c.state_uf IS NOT NULL
  AND length(c.state_uf) = 2;
UPDATE public.profiles
SET state = public.normalize_uf(state)
WHERE state IS NOT NULL AND state <> COALESCE(public.normalize_uf(state), '');

-- 2d) agencies
UPDATE public.agencies
SET state = public.normalize_uf(state)
WHERE state IS NOT NULL AND state <> COALESCE(public.normalize_uf(state), '');

-- 2e) jobs
UPDATE public.jobs j
SET state = c.state_uf
FROM public.cities c
WHERE (j.state IS NULL OR public.normalize_uf(j.state) IS NULL)
  AND c.name = j.city
  AND c.state_uf IS NOT NULL
  AND length(c.state_uf) = 2;
UPDATE public.jobs
SET state = public.normalize_uf(state)
WHERE state IS NOT NULL AND state <> COALESCE(public.normalize_uf(state), '');

-- 3) Triggers genéricas de proteção em INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.trg_normalize_state_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.state := public.normalize_uf(NEW.state);
  RETURN NEW;
END;
$$;

-- providers — substitui a trigger antiga pela nova baseada em normalize_uf
DROP TRIGGER IF EXISTS trg_validate_provider_state ON public.providers;
DROP TRIGGER IF EXISTS trg_normalize_state_providers ON public.providers;
CREATE TRIGGER trg_normalize_state_providers
BEFORE INSERT OR UPDATE OF state ON public.providers
FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_state_column();

-- profiles
DROP TRIGGER IF EXISTS trg_normalize_state_profiles ON public.profiles;
CREATE TRIGGER trg_normalize_state_profiles
BEFORE INSERT OR UPDATE OF state ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_state_column();

-- agencies
DROP TRIGGER IF EXISTS trg_normalize_state_agencies ON public.agencies;
CREATE TRIGGER trg_normalize_state_agencies
BEFORE INSERT OR UPDATE OF state ON public.agencies
FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_state_column();

-- jobs
DROP TRIGGER IF EXISTS trg_normalize_state_jobs ON public.jobs;
CREATE TRIGGER trg_normalize_state_jobs
BEFORE INSERT OR UPDATE OF state ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_state_column();
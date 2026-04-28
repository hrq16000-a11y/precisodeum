-- 1) Coluna de origem do bairro
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS neighborhood_source text
    CHECK (neighborhood_source IN ('user','default_centro','unknown')) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS neighborhood_source_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_providers_neighborhood_source
  ON public.providers (neighborhood_source) WHERE neighborhood_source = 'default_centro';

-- 2) Atualiza trigger para registrar origem
CREATE OR REPLACE FUNCTION public.fill_provider_neighborhood_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Bairro digitado pelo usuário tem prioridade absoluta
  IF NEW.neighborhood IS NOT NULL AND length(btrim(NEW.neighborhood)) > 0
     AND NEW.neighborhood <> 'Centro' THEN
    NEW.neighborhood_source := 'user';
    IF NEW.neighborhood_source_at IS NULL THEN
      NEW.neighborhood_source_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- Cidade preenchida + bairro vazio → fallback "Centro"
  IF (NEW.city IS NOT NULL AND length(btrim(NEW.city)) > 0)
     AND (NEW.neighborhood IS NULL OR length(btrim(NEW.neighborhood)) = 0
          OR NEW.neighborhood = 'Centro') THEN
    NEW.neighborhood := 'Centro';
    NEW.neighborhood_source := 'default_centro';
    NEW.neighborhood_source_at := COALESCE(NEW.neighborhood_source_at, now());
  ELSE
    NEW.neighborhood_source := COALESCE(NEW.neighborhood_source, 'unknown');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- 3) Backfill: marca os 92 já preenchidos com Centro como default_centro
UPDATE public.providers
SET neighborhood_source = 'default_centro',
    neighborhood_source_at = COALESCE(neighborhood_source_at, now())
WHERE neighborhood = 'Centro'
  AND (neighborhood_source IS NULL OR neighborhood_source = 'unknown');

-- Marca quem digitou bairro próprio como 'user'
UPDATE public.providers
SET neighborhood_source = 'user',
    neighborhood_source_at = COALESCE(neighborhood_source_at, now())
WHERE neighborhood IS NOT NULL
  AND length(btrim(neighborhood)) > 0
  AND neighborhood <> 'Centro'
  AND (neighborhood_source IS NULL OR neighborhood_source = 'unknown');

-- 4) RPC admin para listar providers com bairro default
CREATE OR REPLACE FUNCTION public.admin_list_default_neighborhood_providers(
  _city text DEFAULT NULL,
  _state text DEFAULT NULL,
  _limit int DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  city text,
  state text,
  neighborhood text,
  neighborhood_source text,
  neighborhood_source_at timestamptz,
  has_coords boolean,
  status text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT p.id, p.user_id, p.full_name, p.city, p.state,
         p.neighborhood, p.neighborhood_source, p.neighborhood_source_at,
         (p.latitude IS NOT NULL AND p.longitude IS NOT NULL) AS has_coords,
         p.status, p.updated_at
  FROM public.providers p
  WHERE p.neighborhood_source = 'default_centro'
    AND (_city IS NULL OR _city = '' OR p.city ILIKE '%' || _city || '%')
    AND (_state IS NULL OR _state = '' OR p.state = _state)
  ORDER BY p.neighborhood_source_at DESC NULLS LAST
  LIMIT GREATEST(_limit, 1);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_default_neighborhood_providers(text,text,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_default_neighborhood_providers(text,text,int) TO authenticated;
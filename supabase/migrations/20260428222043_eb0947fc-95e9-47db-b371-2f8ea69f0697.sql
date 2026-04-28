
-- 1) Estende auditoria com colunas para tentativas bloqueadas
ALTER TABLE public.service_area_corrections
  ADD COLUMN IF NOT EXISTS attempt_payload jsonb,
  ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;

-- 2) Catálogo de termos proibidos (anti-leilão), editável pelo admin
CREATE TABLE IF NOT EXISTS public.forbidden_service_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL UNIQUE,
  suggestion text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.forbidden_service_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_forbidden_terms" ON public.forbidden_service_terms;
CREATE POLICY "anyone_can_read_forbidden_terms"
  ON public.forbidden_service_terms FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "admin_manage_forbidden_terms" ON public.forbidden_service_terms;
CREATE POLICY "admin_manage_forbidden_terms"
  ON public.forbidden_service_terms FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed (idempotente)
INSERT INTO public.forbidden_service_terms (term, suggestion) VALUES
  ('barato', 'Ofereço excelente custo-benefício com foco em qualidade técnica.'),
  ('leilão', 'Negociação direta e transparente com o cliente.'),
  ('leilao', 'Negociação direta e transparente com o cliente.'),
  ('desconto', 'Condições especiais para projetos completos.'),
  ('orçamento', 'Atendimento personalizado para cada demanda.'),
  ('orcamento', 'Atendimento personalizado para cada demanda.'),
  ('promoção', 'Pacotes com condições especiais.'),
  ('promocao', 'Pacotes com condições especiais.')
ON CONFLICT (term) DO NOTHING;

-- 3) Função: cidade está no catálogo? (heurística: existe pelo menos 1 provider com essa cidade exata)
--    Esta é a fonte canônica do servidor: o catálogo IBGE vive no client (CITIES_INDEX),
--    mas no servidor consideramos válido qualquer city já materializada em providers.city
--    (que por sua vez é populada via autocomplete IBGE).
CREATE OR REPLACE FUNCTION public.service_area_is_in_catalog(p_city text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
BEGIN
  IF p_city IS NULL OR length(trim(p_city)) = 0 THEN
    RETURN false;
  END IF;
  v_norm := lower(trim(p_city));

  -- Aceita se existe provider com essa cidade (qualquer um)
  IF EXISTS (
    SELECT 1 FROM public.providers
    WHERE city IS NOT NULL AND lower(trim(city)) = v_norm
    LIMIT 1
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 4) Função: descrição contém termos proibidos? Retorna o primeiro termo encontrado ou NULL.
CREATE OR REPLACE FUNCTION public.service_description_first_forbidden_term(p_text text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_term text;
BEGIN
  IF p_text IS NULL OR length(trim(p_text)) = 0 THEN
    RETURN NULL;
  END IF;
  v_norm := lower(p_text);

  SELECT term INTO v_term
  FROM public.forbidden_service_terms
  WHERE active = true
    AND v_norm ~* ('\m' || term || '\M')
  LIMIT 1;

  RETURN v_term;
END;
$$;

-- 5) Trigger principal estendido: kill-switch + radius coercion
CREATE OR REPLACE FUNCTION public.enforce_service_city_coherence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_provider_city text;
  v_clean_area text;
  v_forbidden text;
BEGIN
  -- 0) Linter de termos proibidos na descrição (kill-switch HTTP 400)
  v_forbidden := public.service_description_first_forbidden_term(NEW.description);
  IF v_forbidden IS NOT NULL THEN
    INSERT INTO public.service_area_corrections (
      service_id, provider_id, previous_value, new_value,
      reason, source, corrected_by, attempt_payload, blocked
    ) VALUES (
      NEW.id, NEW.provider_id,
      left(coalesce(NEW.description,''), 200),
      NULL,
      'forbidden_term_blocked:' || v_forbidden,
      'trigger',
      NULL,
      jsonb_build_object('description', NEW.description, 'service_area', NEW.service_area),
      true
    );
    RAISE EXCEPTION 'Descrição contém termo proibido (anti-leilão): %', v_forbidden
      USING ERRCODE = 'check_violation';
  END IF;

  -- 1) Sanitiza prefixos legados em service_area
  IF NEW.service_area IS NOT NULL THEN
    v_clean_area := regexp_replace(NEW.service_area, '^\s*(em\s+)?(toda|todo)\s+', '', 'i');
    v_clean_area := trim(v_clean_area);
    NEW.service_area := NULLIF(v_clean_area, '');
  END IF;

  -- 2) Busca cidade do provider
  SELECT city INTO v_provider_city
  FROM public.providers
  WHERE id = NEW.provider_id;

  -- 3) Coerência radius=city: trava service_area = provider.city
  IF NEW.service_radius = 'city'
     AND v_provider_city IS NOT NULL
     AND length(trim(v_provider_city)) > 0
     AND (NEW.service_area IS NULL OR lower(trim(NEW.service_area)) <> lower(trim(v_provider_city))) THEN

    INSERT INTO public.service_area_corrections (
      service_id, provider_id, previous_value, new_value,
      reason, source, corrected_by
    ) VALUES (
      NEW.id, NEW.provider_id,
      COALESCE(NEW.service_area, '(vazio)'),
      v_provider_city,
      'radius_city_lock',
      'trigger',
      NULL
    );
    NEW.service_area := v_provider_city;
  END IF;

  -- 4) Coerência cidade do serviço x cidade do provider
  IF v_provider_city IS NOT NULL AND length(trim(v_provider_city)) > 0 THEN
    IF NEW.service_area IS NULL
       OR lower(trim(NEW.service_area)) <> lower(trim(v_provider_city)) THEN

      IF NEW.service_area IS DISTINCT FROM v_provider_city THEN
        INSERT INTO public.service_area_corrections (
          service_id, provider_id, previous_value, new_value,
          reason, source, corrected_by
        ) VALUES (
          NEW.id, NEW.provider_id,
          COALESCE(NEW.service_area, '(vazio)'),
          v_provider_city,
          'city_mismatch_autofix',
          'trigger',
          NULL
        );
      END IF;

      NEW.service_area := v_provider_city;
    END IF;
  ELSE
    -- 5) Provider sem cidade: kill-switch — service_area DEVE estar no catálogo
    IF NEW.service_area IS NULL OR length(trim(NEW.service_area)) = 0 THEN
      INSERT INTO public.service_area_corrections (
        service_id, provider_id, previous_value, new_value,
        reason, source, corrected_by, attempt_payload, blocked
      ) VALUES (
        NEW.id, NEW.provider_id, '(vazio)', NULL,
        'service_area_required',
        'trigger', NULL,
        jsonb_build_object('service_area', NEW.service_area),
        true
      );
      RAISE EXCEPTION 'service_area é obrigatório quando o provider ainda não tem cidade'
        USING ERRCODE = 'not_null_violation';
    END IF;

    IF NOT public.service_area_is_in_catalog(NEW.service_area) THEN
      INSERT INTO public.service_area_corrections (
        service_id, provider_id, previous_value, new_value,
        reason, source, corrected_by, attempt_payload, blocked
      ) VALUES (
        NEW.id, NEW.provider_id, NEW.service_area, NULL,
        'city_not_in_catalog',
        'trigger', NULL,
        jsonb_build_object('service_area', NEW.service_area),
        true
      );
      RAISE EXCEPTION 'Cidade "%" não está no catálogo oficial (IBGE).', NEW.service_area
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_service_city_coherence ON public.services;
CREATE TRIGGER trg_enforce_service_city_coherence
  BEFORE INSERT OR UPDATE OF service_area, provider_id, description, service_radius ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_service_city_coherence();

-- 6) Permissões mínimas
REVOKE ALL ON FUNCTION public.service_area_is_in_catalog(text) FROM public;
GRANT EXECUTE ON FUNCTION public.service_area_is_in_catalog(text) TO authenticated, anon;

REVOKE ALL ON FUNCTION public.service_description_first_forbidden_term(text) FROM public;
GRANT EXECUTE ON FUNCTION public.service_description_first_forbidden_term(text) TO authenticated, anon;

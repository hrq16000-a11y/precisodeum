
-- 1) Trigger de validação city <-> service_area no momento do INSERT/UPDATE de services
CREATE OR REPLACE FUNCTION public.enforce_service_city_coherence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_provider_city text;
  v_clean_area text;
BEGIN
  -- Normalize: strip "Toda " / "Em toda " / "Todo " prefixes
  IF NEW.service_area IS NOT NULL THEN
    v_clean_area := regexp_replace(NEW.service_area, '^\s*(em\s+)?(toda|todo)\s+', '', 'i');
    v_clean_area := trim(v_clean_area);
    NEW.service_area := NULLIF(v_clean_area, '');
  END IF;

  -- Fetch provider city
  SELECT city INTO v_provider_city
  FROM public.providers
  WHERE id = NEW.provider_id;

  -- If provider has a city and service_area diverges, force coherence and audit
  IF v_provider_city IS NOT NULL AND length(trim(v_provider_city)) > 0 THEN
    IF NEW.service_area IS NULL
       OR lower(trim(NEW.service_area)) <> lower(trim(v_provider_city)) THEN

      -- Audit only when it changes something meaningful
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_service_city_coherence ON public.services;
CREATE TRIGGER trg_enforce_service_city_coherence
  BEFORE INSERT OR UPDATE OF service_area, provider_id ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_service_city_coherence();

-- 2) Job periódico: sincroniza divergências em lote
CREATE OR REPLACE FUNCTION public.admin_sync_provider_city_with_services(p_dry_run boolean DEFAULT false)
RETURNS TABLE(service_id uuid, provider_id uuid, before_value text, after_value text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR r IN
    SELECT s.id AS sid, s.provider_id AS pid, s.service_area AS sa, p.city AS pc
    FROM public.services s
    JOIN public.providers p ON p.id = s.provider_id
    WHERE p.city IS NOT NULL
      AND length(trim(p.city)) > 0
      AND (
        s.service_area IS NULL
        OR lower(trim(s.service_area)) <> lower(trim(p.city))
      )
  LOOP
    IF NOT p_dry_run THEN
      INSERT INTO public.service_area_corrections (
        service_id, provider_id, previous_value, new_value,
        reason, source, corrected_by
      ) VALUES (
        r.sid, r.pid, COALESCE(r.sa, '(vazio)'), r.pc,
        'periodic_sync_autofix', 'cron_job', auth.uid()
      );
      UPDATE public.services SET service_area = r.pc WHERE id = r.sid;
    END IF;

    service_id := r.sid; provider_id := r.pid;
    before_value := r.sa; after_value := r.pc;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 3) Listagem para auditoria admin (com filtros)
CREATE OR REPLACE FUNCTION public.admin_list_service_area_corrections(
  p_provider_id uuid DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 200
)
RETURNS TABLE(
  id uuid,
  service_id uuid,
  provider_id uuid,
  provider_name text,
  previous_value text,
  new_value text,
  reason text,
  source text,
  corrected_by uuid,
  corrector_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    c.id, c.service_id, c.provider_id,
    pr.business_name AS provider_name,
    c.previous_value, c.new_value, c.reason, c.source,
    c.corrected_by, prof.full_name AS corrector_name,
    c.created_at
  FROM public.service_area_corrections c
  LEFT JOIN public.providers pr ON pr.id = c.provider_id
  LEFT JOIN public.profiles prof ON prof.id = c.corrected_by
  WHERE (p_provider_id IS NULL OR c.provider_id = p_provider_id)
    AND (p_city IS NULL OR lower(c.new_value) = lower(p_city) OR lower(c.previous_value) = lower(p_city))
    AND (p_from IS NULL OR c.created_at >= p_from)
    AND (p_to IS NULL OR c.created_at <= p_to)
  ORDER BY c.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
END;
$$;

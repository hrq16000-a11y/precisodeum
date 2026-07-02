-- ──────────────────────────────────────────────────────────
-- Disponibilidade & janelas de agendamento em leads
-- ──────────────────────────────────────────────────────────
-- 1) providers.contact_hours: dias da semana (0..6, 0=dom) e períodos aceitos.
--    Períodos canônicos: 'morning' (08-12), 'afternoon' (12-18), 'evening' (18-21).
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS contact_hours jsonb NOT NULL
  DEFAULT '{"days":[1,2,3,4,5,6],"periods":["morning","afternoon"],"timezone":"America/Sao_Paulo"}'::jsonb;

-- 2) leads.preferred_window: janela escolhida pelo cliente (opcional).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS preferred_window jsonb;

-- 3) leads.preferred_match: 'match' | 'mismatch' | 'unspecified' — calculado por trigger.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS preferred_match text NOT NULL DEFAULT 'unspecified';

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_preferred_match_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_preferred_match_check
  CHECK (preferred_match IN ('match', 'mismatch', 'unspecified'));

-- Índice para filtrar/ordenar por janela preferida
CREATE INDEX IF NOT EXISTS idx_leads_preferred_match
  ON public.leads(provider_id, preferred_match, created_at DESC);

-- 4) Validação leve da estrutura de contact_hours (trigger, não CHECK, pois jsonb).
CREATE OR REPLACE FUNCTION public.validate_provider_contact_hours()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_days jsonb;
  v_periods jsonb;
  v_day int;
  v_period text;
BEGIN
  IF NEW.contact_hours IS NULL THEN
    NEW.contact_hours := '{"days":[1,2,3,4,5,6],"periods":["morning","afternoon"],"timezone":"America/Sao_Paulo"}'::jsonb;
    RETURN NEW;
  END IF;

  v_days := COALESCE(NEW.contact_hours->'days', '[]'::jsonb);
  v_periods := COALESCE(NEW.contact_hours->'periods', '[]'::jsonb);

  -- days: cada item deve ser int 0..6
  FOR v_day IN SELECT (jsonb_array_elements_text(v_days))::int LOOP
    IF v_day < 0 OR v_day > 6 THEN
      RAISE EXCEPTION 'contact_hours.days inválido (% fora de 0..6)', v_day;
    END IF;
  END LOOP;

  -- periods: morning/afternoon/evening
  FOR v_period IN SELECT jsonb_array_elements_text(v_periods) LOOP
    IF v_period NOT IN ('morning','afternoon','evening') THEN
      RAISE EXCEPTION 'contact_hours.periods inválido (% não é morning/afternoon/evening)', v_period;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_provider_contact_hours ON public.providers;
CREATE TRIGGER trg_validate_provider_contact_hours
  BEFORE INSERT OR UPDATE OF contact_hours ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.validate_provider_contact_hours();

-- 5) Trigger em leads: computa preferred_match cruzando preferred_window com providers.contact_hours.
CREATE OR REPLACE FUNCTION public.compute_lead_preferred_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pref_day int;
  v_pref_period text;
  v_hours jsonb;
  v_days jsonb;
  v_periods jsonb;
BEGIN
  IF NEW.preferred_window IS NULL OR NEW.preferred_window = '{}'::jsonb THEN
    NEW.preferred_match := 'unspecified';
    RETURN NEW;
  END IF;

  v_pref_day := NULLIF(NEW.preferred_window->>'day','')::int;
  v_pref_period := NEW.preferred_window->>'period';

  IF v_pref_day IS NULL OR v_pref_period IS NULL THEN
    NEW.preferred_match := 'unspecified';
    RETURN NEW;
  END IF;

  IF v_pref_period NOT IN ('morning','afternoon','evening') THEN
    NEW.preferred_match := 'unspecified';
    RETURN NEW;
  END IF;

  SELECT contact_hours INTO v_hours FROM public.providers WHERE id = NEW.provider_id;
  IF v_hours IS NULL THEN
    NEW.preferred_match := 'unspecified';
    RETURN NEW;
  END IF;

  v_days := COALESCE(v_hours->'days','[]'::jsonb);
  v_periods := COALESCE(v_hours->'periods','[]'::jsonb);

  IF v_days @> to_jsonb(v_pref_day) AND v_periods @> to_jsonb(v_pref_period) THEN
    NEW.preferred_match := 'match';
  ELSE
    NEW.preferred_match := 'mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_lead_preferred_match ON public.leads;
CREATE TRIGGER trg_compute_lead_preferred_match
  BEFORE INSERT OR UPDATE OF preferred_window ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.compute_lead_preferred_match();

-- 6) RPC pública para sugerir o próximo slot dentro do contact_hours.
--    Retorna day/period/iso_date no fuso configurado (ou America/Sao_Paulo por padrão).
CREATE OR REPLACE FUNCTION public.suggest_next_contact_slot(
  _provider_id uuid,
  _from_ts timestamptz DEFAULT now()
)
RETURNS TABLE(day int, period text, iso_date date)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours jsonb;
  v_tz text;
  v_days jsonb;
  v_periods jsonb;
  v_local timestamptz;
  v_local_date date;
  v_local_hour int;
  v_period_order text[] := ARRAY['morning','afternoon','evening'];
  v_offset int;
  v_candidate_date date;
  v_candidate_dow int;
  v_period text;
  v_period_idx int;
  v_today_min_idx int := 0;
BEGIN
  SELECT contact_hours INTO v_hours FROM public.providers WHERE id = _provider_id;
  IF v_hours IS NULL THEN
    RETURN;
  END IF;

  v_tz := COALESCE(v_hours->>'timezone','America/Sao_Paulo');
  v_days := COALESCE(v_hours->'days','[]'::jsonb);
  v_periods := COALESCE(v_hours->'periods','[]'::jsonb);

  IF jsonb_array_length(v_days) = 0 OR jsonb_array_length(v_periods) = 0 THEN
    RETURN;
  END IF;

  v_local := _from_ts AT TIME ZONE v_tz;
  v_local_date := v_local::date;
  v_local_hour := EXTRACT(HOUR FROM v_local)::int;

  -- Para "hoje", só considerar períodos que ainda não passaram
  IF v_local_hour < 12 THEN
    v_today_min_idx := 0; -- morning ainda válido
  ELSIF v_local_hour < 18 THEN
    v_today_min_idx := 1; -- afternoon
  ELSIF v_local_hour < 21 THEN
    v_today_min_idx := 2; -- evening
  ELSE
    v_today_min_idx := 3; -- nada hoje
  END IF;

  -- Procura nos próximos 14 dias
  FOR v_offset IN 0..14 LOOP
    v_candidate_date := v_local_date + v_offset;
    v_candidate_dow := EXTRACT(DOW FROM v_candidate_date)::int;

    IF NOT (v_days @> to_jsonb(v_candidate_dow)) THEN
      CONTINUE;
    END IF;

    FOR v_period_idx IN 0..2 LOOP
      v_period := v_period_order[v_period_idx + 1];
      IF v_offset = 0 AND v_period_idx < v_today_min_idx THEN
        CONTINUE;
      END IF;
      IF v_periods @> to_jsonb(v_period) THEN
        day := v_candidate_dow;
        period := v_period;
        iso_date := v_candidate_date;
        RETURN NEXT;
        RETURN;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_next_contact_slot(uuid, timestamptz) TO anon, authenticated;
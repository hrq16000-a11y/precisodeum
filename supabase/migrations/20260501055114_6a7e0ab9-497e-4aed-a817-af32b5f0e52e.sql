-- Add structured working hours (jsonb) + derived filter columns
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS working_hours_struct jsonb,
  ADD COLUMN IF NOT EXISTS opens_weekend boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opens_late_night boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opens_overnight boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_24h boolean NOT NULL DEFAULT false;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS working_hours_struct jsonb,
  ADD COLUMN IF NOT EXISTS opens_weekend boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opens_late_night boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opens_overnight boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_24h boolean NOT NULL DEFAULT false;

-- Function: deriva flags a partir do working_hours_struct
-- Estrutura esperada: { "ranges": [ { "days": ["mon","tue",...], "start": "08:00", "end": "18:00" } ] }
-- "24h" = start "00:00" e end "00:00" (ou "24:00")
CREATE OR REPLACE FUNCTION public.derive_working_hours_flags(_struct jsonb)
RETURNS TABLE(opens_weekend boolean, opens_late_night boolean, opens_overnight boolean, is_24h boolean)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  r jsonb;
  d text;
  s_min int;
  e_min int;
  s_txt text;
  e_txt text;
  ow boolean := false;
  oln boolean := false; -- after 20:00
  oov boolean := false; -- 00:00-06:00
  o24 boolean := false;
BEGIN
  IF _struct IS NULL OR jsonb_typeof(_struct->'ranges') <> 'array' THEN
    RETURN QUERY SELECT false, false, false, false;
    RETURN;
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(_struct->'ranges') LOOP
    s_txt := COALESCE(r->>'start','');
    e_txt := COALESCE(r->>'end','');
    IF s_txt = '' OR e_txt = '' THEN CONTINUE; END IF;

    -- minutos
    s_min := (split_part(s_txt,':',1)::int)*60 + COALESCE(NULLIF(split_part(s_txt,':',2),'')::int,0);
    e_min := (split_part(e_txt,':',1)::int)*60 + COALESCE(NULLIF(split_part(e_txt,':',2),'')::int,0);

    -- 24h: start=end=0  OU  start=0 e end=1440 (24:00)
    IF (s_min = 0 AND (e_min = 0 OR e_min = 1440)) THEN
      o24 := true;
      ow := true; oln := true; oov := true;
    END IF;

    -- normaliza "fim 0" como 1440 para cálculos abaixo
    IF e_min = 0 AND s_min <> 0 THEN e_min := 1440; END IF;

    -- após 20h
    IF e_min > 1200 OR e_min = 0 THEN oln := true; END IF;
    -- madrugada 00-06h: cobre se start<360 ou faixa cruza meia-noite (e_min < s_min)
    IF s_min < 360 OR e_min < s_min THEN oov := true; END IF;

    -- fim de semana: algum dia sat/sun
    FOR d IN SELECT jsonb_array_elements_text(COALESCE(r->'days','[]'::jsonb)) LOOP
      IF d IN ('sat','sun') THEN ow := true; END IF;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT ow, oln, oov, o24;
END;
$$;

-- Trigger function que mantém as flags em sync
CREATE OR REPLACE FUNCTION public.trg_sync_working_hours_flags()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  flags record;
BEGIN
  SELECT * INTO flags FROM public.derive_working_hours_flags(NEW.working_hours_struct);
  NEW.opens_weekend := COALESCE(flags.opens_weekend, false);
  NEW.opens_late_night := COALESCE(flags.opens_late_night, false);
  NEW.opens_overnight := COALESCE(flags.opens_overnight, false);
  NEW.is_24h := COALESCE(flags.is_24h, false);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_providers_sync_wh_flags ON public.providers;
CREATE TRIGGER trg_providers_sync_wh_flags
  BEFORE INSERT OR UPDATE OF working_hours_struct ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_working_hours_flags();

DROP TRIGGER IF EXISTS trg_services_sync_wh_flags ON public.services;
CREATE TRIGGER trg_services_sync_wh_flags
  BEFORE INSERT OR UPDATE OF working_hours_struct ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_working_hours_flags();

-- Índices para os filtros
CREATE INDEX IF NOT EXISTS idx_providers_opens_weekend ON public.providers(opens_weekend) WHERE opens_weekend;
CREATE INDEX IF NOT EXISTS idx_providers_opens_late_night ON public.providers(opens_late_night) WHERE opens_late_night;
CREATE INDEX IF NOT EXISTS idx_providers_opens_overnight ON public.providers(opens_overnight) WHERE opens_overnight;
CREATE INDEX IF NOT EXISTS idx_providers_is_24h ON public.providers(is_24h) WHERE is_24h;
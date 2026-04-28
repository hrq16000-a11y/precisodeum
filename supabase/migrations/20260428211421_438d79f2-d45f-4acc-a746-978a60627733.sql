-- ============================================================================
-- Service Area Hardening: normaliza valores legados e cria auditoria
-- ============================================================================

-- 1. Tabela de auditoria de correções de service_area
CREATE TABLE IF NOT EXISTS public.service_area_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  provider_id UUID,
  previous_value TEXT,
  new_value TEXT,
  reason TEXT NOT NULL DEFAULT 'auto_normalize_legacy',
  source TEXT NOT NULL DEFAULT 'backfill_v1',
  corrected_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_area_corrections ENABLE ROW LEVEL SECURITY;

-- Apenas admin pode ler/escrever
CREATE POLICY "Admin can view service_area_corrections"
  ON public.service_area_corrections FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert service_area_corrections"
  ON public.service_area_corrections FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_service_area_corrections_service
  ON public.service_area_corrections(service_id);
CREATE INDEX IF NOT EXISTS idx_service_area_corrections_created
  ON public.service_area_corrections(created_at DESC);

-- 2. Função de normalização (idempotente). Remove prefixos espúrios
--    "Toda ", "Em toda ", "Todo ", e trims. Retorna NULL se virar vazio.
CREATE OR REPLACE FUNCTION public.normalize_service_area_text(_raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_clean TEXT;
BEGIN
  IF _raw IS NULL THEN RETURN NULL; END IF;
  v_clean := trim(_raw);
  -- Remove prefixos legados "(Em )?(Toda|Todo) "
  v_clean := regexp_replace(v_clean, '^(em\s+)?(toda|todo)\s+', '', 'i');
  v_clean := trim(v_clean);
  IF v_clean = '' THEN RETURN NULL; END IF;
  RETURN v_clean;
END;
$$;

-- 3. Trigger que mantém service_area limpo em INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.trg_sanitize_service_area()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.service_area IS NOT NULL THEN
    NEW.service_area := public.normalize_service_area_text(NEW.service_area);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sanitize_service_area_trigger ON public.services;
CREATE TRIGGER sanitize_service_area_trigger
  BEFORE INSERT OR UPDATE OF service_area ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trg_sanitize_service_area();

-- 4. Backfill: normaliza tudo que está sujo agora e registra auditoria
DO $$
DECLARE
  r RECORD;
  v_new TEXT;
BEGIN
  FOR r IN
    SELECT id, provider_id, service_area
      FROM public.services
     WHERE service_area IS NOT NULL
       AND (
         service_area ~* '^(em\s+)?(toda|todo)\s+'
         OR service_area <> trim(service_area)
       )
  LOOP
    v_new := public.normalize_service_area_text(r.service_area);
    IF v_new IS DISTINCT FROM r.service_area THEN
      INSERT INTO public.service_area_corrections
        (service_id, provider_id, previous_value, new_value, reason, source)
      VALUES
        (r.id, r.provider_id, r.service_area, v_new,
         'auto_normalize_legacy', 'backfill_v1_2026_04_28');
      UPDATE public.services SET service_area = v_new WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- 5. RPC admin para listar correções com paginação
CREATE OR REPLACE FUNCTION public.admin_list_service_area_corrections(
  _limit INT DEFAULT 100,
  _offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  service_id UUID,
  service_name TEXT,
  provider_id UUID,
  provider_name TEXT,
  previous_value TEXT,
  new_value TEXT,
  reason TEXT,
  source TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT c.id, c.service_id, s.service_name, c.provider_id, p.business_name,
         c.previous_value, c.new_value, c.reason, c.source, c.created_at
    FROM public.service_area_corrections c
    LEFT JOIN public.services s ON s.id = c.service_id
    LEFT JOIN public.providers p ON p.id = c.provider_id
   ORDER BY c.created_at DESC
   LIMIT _limit OFFSET _offset;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_service_area_corrections(INT, INT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_service_area_corrections(INT, INT) TO authenticated;
-- =====================================================================
-- Correção em lote de bairros padrão "Centro" + auditoria persistida.
-- =====================================================================

-- 1) Tabela de auditoria de correções de bairro feitas pelo admin.
CREATE TABLE IF NOT EXISTS public.provider_neighborhood_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  previous_neighborhood TEXT,
  previous_source TEXT,
  new_neighborhood TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pnc_provider ON public.provider_neighborhood_corrections(provider_id);
CREATE INDEX IF NOT EXISTS idx_pnc_admin ON public.provider_neighborhood_corrections(admin_id);
CREATE INDEX IF NOT EXISTS idx_pnc_created ON public.provider_neighborhood_corrections(created_at DESC);

ALTER TABLE public.provider_neighborhood_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin select pnc" ON public.provider_neighborhood_corrections;
CREATE POLICY "admin select pnc"
  ON public.provider_neighborhood_corrections FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin insert pnc" ON public.provider_neighborhood_corrections;
CREATE POLICY "admin insert pnc"
  ON public.provider_neighborhood_corrections FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) RPC: admin corrige bairro de um provider, registrando justificativa.
CREATE OR REPLACE FUNCTION public.admin_fix_provider_neighborhood(
  _provider_id UUID,
  _new_neighborhood TEXT,
  _reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_prev_n TEXT;
  v_prev_src TEXT;
  v_new TEXT := COALESCE(NULLIF(btrim(_new_neighborhood), ''), 'Centro');
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT neighborhood, neighborhood_source
    INTO v_prev_n, v_prev_src
    FROM public.providers
   WHERE id = _provider_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'provider_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.providers
     SET neighborhood = v_new,
         neighborhood_source = 'admin_fix',
         neighborhood_source_at = now(),
         updated_at = now()
   WHERE id = _provider_id;

  INSERT INTO public.provider_neighborhood_corrections
    (provider_id, admin_id, previous_neighborhood, previous_source, new_neighborhood, reason)
  VALUES
    (_provider_id, v_admin, v_prev_n, v_prev_src, v_new, btrim(_reason));

  RETURN jsonb_build_object(
    'ok', true,
    'provider_id', _provider_id,
    'previous', v_prev_n,
    'new', v_new
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_fix_provider_neighborhood(UUID, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_fix_provider_neighborhood(UUID, TEXT, TEXT) TO authenticated;

-- 3) RPC: correção em lote (lista de IDs com mesmo bairro + mesma justificativa).
CREATE OR REPLACE FUNCTION public.admin_bulk_fix_provider_neighborhood(
  _provider_ids UUID[],
  _new_neighborhood TEXT,
  _reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_id UUID;
  v_count INT := 0;
  v_errors INT := 0;
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  IF _provider_ids IS NULL OR array_length(_provider_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'updated', 0, 'errors', 0);
  END IF;

  FOREACH v_id IN ARRAY _provider_ids LOOP
    BEGIN
      PERFORM public.admin_fix_provider_neighborhood(v_id, _new_neighborhood, _reason);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'updated', v_count, 'errors', v_errors);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_fix_provider_neighborhood(UUID[], TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_bulk_fix_provider_neighborhood(UUID[], TEXT, TEXT) TO authenticated;

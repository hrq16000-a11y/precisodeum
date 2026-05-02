-- 1) Unicidade de user_id (deduplica antes via lateral check — já está limpo, mas defensivo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'providers' AND c.conname = 'providers_user_id_key'
  ) THEN
    -- Só cria se não houver duplicatas
    IF NOT EXISTS (
      SELECT 1 FROM public.providers GROUP BY user_id HAVING COUNT(*) > 1
    ) THEN
      ALTER TABLE public.providers ADD CONSTRAINT providers_user_id_key UNIQUE (user_id);
    END IF;
  END IF;
END$$;

-- 2) Trigger: bloqueia promoção a active/approved sem bairro+cidade+coords
CREATE OR REPLACE FUNCTION public.guard_provider_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('active','approved') THEN
    IF COALESCE(NULLIF(TRIM(NEW.city),''), NULL) IS NULL THEN
      RAISE EXCEPTION 'PROVIDER_INCOMPLETE_CITY' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(NULLIF(TRIM(NEW.neighborhood),''), NULL) IS NULL THEN
      RAISE EXCEPTION 'PROVIDER_INCOMPLETE_NEIGHBORHOOD' USING ERRCODE = '22023';
    END IF;
    IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
      RAISE EXCEPTION 'PROVIDER_INCOMPLETE_COORDINATES' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_provider_activation ON public.providers;
CREATE TRIGGER trg_guard_provider_activation
BEFORE INSERT OR UPDATE OF status, city, neighborhood, latitude, longitude
ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.guard_provider_activation();

-- 3) Função utilitária para marcar fantasmas (executada por cron/admin manualmente)
CREATE OR REPLACE FUNCTION public.mark_ghost_providers()
RETURNS TABLE(marked_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.providers
    SET status = 'archived', updated_at = now()
    WHERE status = 'pending'
      AND created_at < now() - interval '60 days'
      AND (business_name IS NULL OR TRIM(business_name) = '')
      AND category_id IS NULL
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO v_count FROM updated;
  RETURN QUERY SELECT v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_ghost_providers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_ghost_providers() TO service_role;
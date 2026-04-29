
-- 1) Índices faltantes (CONCURRENTLY não funciona em migration; usar sem ele)
CREATE INDEX IF NOT EXISTS idx_leads_user_ref ON public.leads (user_ref);
CREATE INDEX IF NOT EXISTS idx_services_user_ref ON public.services (user_ref);
CREATE INDEX IF NOT EXISTS idx_providers_user_ref ON public.providers (user_ref);
CREATE INDEX IF NOT EXISTS idx_provider_page_settings_user_ref ON public.provider_page_settings (user_ref);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_ref ON public.user_roles (user_ref);

-- 2) Trigger para preencher user_ref em sponsors a partir de user_id
CREATE OR REPLACE FUNCTION public.fill_sponsor_user_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_ref IS NULL OR NEW.user_ref = '' THEN
    IF NEW.user_id IS NOT NULL THEN
      NEW.user_ref := NEW.user_id::text;
    ELSIF NEW.email IS NOT NULL AND NEW.email <> '' THEN
      NEW.user_ref := 'email:' || lower(NEW.email);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_sponsor_user_ref ON public.sponsors;
CREATE TRIGGER trg_fill_sponsor_user_ref
BEFORE INSERT OR UPDATE ON public.sponsors
FOR EACH ROW EXECUTE FUNCTION public.fill_sponsor_user_ref();

-- 3) Backfill imediato dos sponsors existentes (UPDATE inline em migration é OK
-- pois é correção pontual junto da estrutura)
UPDATE public.sponsors
SET user_ref = COALESCE(user_id::text, 'email:' || lower(email))
WHERE (user_ref IS NULL OR user_ref = '')
  AND (user_id IS NOT NULL OR (email IS NOT NULL AND email <> ''));

-- 4) Função de auditoria de saúde do user_ref (admin-only)
CREATE OR REPLACE FUNCTION public.audit_user_ref_health()
RETURNS TABLE (
  table_name text,
  total_rows bigint,
  filled bigint,
  missing bigint,
  has_index boolean,
  data_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  q text;
  res record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR rec IN
    SELECT c.table_name AS tname, c.data_type AS dtype
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema='public'
      AND c.column_name='user_ref'
      AND t.table_type='BASE TABLE'
    ORDER BY c.table_name
  LOOP
    q := format(
      'SELECT %L::text AS tname, COUNT(*)::bigint AS total, COUNT(user_ref)::bigint AS filled FROM public.%I',
      rec.tname, rec.tname
    );
    EXECUTE q INTO res;
    table_name := rec.tname;
    data_type := rec.dtype;
    total_rows := res.total;
    filled := res.filled;
    missing := res.total - res.filled;
    has_index := EXISTS (
      SELECT 1 FROM pg_class t2
      JOIN pg_index ix ON t2.oid = ix.indrelid
      JOIN pg_attribute a ON a.attrelid = t2.oid AND a.attnum = ANY(ix.indkey)
      JOIN pg_namespace n ON n.oid = t2.relnamespace
      WHERE n.nspname='public' AND t2.relname=rec.tname AND a.attname='user_ref'
    );
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_user_ref_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_user_ref_health() TO authenticated;

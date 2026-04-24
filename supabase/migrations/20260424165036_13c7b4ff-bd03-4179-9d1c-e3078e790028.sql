-- 1) Corrige a função existente para nunca retornar NULL em colunas NOT NULL
CREATE OR REPLACE FUNCTION public.trg_normalize_state_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v text;
BEGIN
  IF NEW.state IS NOT NULL THEN
    v := public.normalize_uf(NEW.state);
    NEW.state := COALESCE(v, '');
  END IF;
  RETURN NEW;
END; $$;

-- 2) Garante triggers nas 4 tabelas (idempotente)
DO $$
DECLARE t text; trg text;
BEGIN
  FOREACH t IN ARRAY ARRAY['providers','profiles','agencies','jobs']
  LOOP
    trg := 'trg_normalize_state_' || t;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', trg, t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF state ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_state_column();', trg, t);
  END LOOP;
END $$;

-- 3) Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.uf_normalization_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  row_id uuid NOT NULL,
  old_state text,
  new_state text,
  source text NOT NULL DEFAULT 'backfill',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.uf_normalization_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read uf audit" ON public.uf_normalization_audit;
CREATE POLICY "Admins read uf audit" ON public.uf_normalization_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4) Backfill com auditoria — providers
WITH fixed AS (
  SELECT p.id, p.state AS old_state,
    COALESCE((SELECT c.state_uf FROM public.cities c WHERE lower(c.name)=lower(p.city) LIMIT 1),
             public.normalize_uf(p.state), '') AS new_state
  FROM public.providers p
  WHERE p.state IS NOT NULL AND (p.state='' OR public.normalize_uf(p.state) IS NULL)
)
INSERT INTO public.uf_normalization_audit(table_name,row_id,old_state,new_state)
SELECT 'providers',id,old_state,new_state FROM fixed WHERE new_state IS DISTINCT FROM old_state;

UPDATE public.providers p SET state = COALESCE(
  (SELECT c.state_uf FROM public.cities c WHERE lower(c.name)=lower(p.city) LIMIT 1),
  public.normalize_uf(p.state), '')
WHERE p.state IS NOT NULL AND (p.state='' OR public.normalize_uf(p.state) IS NULL)
  AND COALESCE((SELECT c.state_uf FROM public.cities c WHERE lower(c.name)=lower(p.city) LIMIT 1),
               public.normalize_uf(p.state), '') IS DISTINCT FROM p.state;

-- 5) Backfill — jobs
WITH fixed AS (
  SELECT j.id, j.state AS old_state,
    COALESCE((SELECT c.state_uf FROM public.cities c WHERE lower(c.name)=lower(j.city) LIMIT 1),
             public.normalize_uf(j.state), '') AS new_state
  FROM public.jobs j
  WHERE j.state IS NOT NULL AND (j.state='' OR public.normalize_uf(j.state) IS NULL)
)
INSERT INTO public.uf_normalization_audit(table_name,row_id,old_state,new_state)
SELECT 'jobs',id,old_state,new_state FROM fixed WHERE new_state IS DISTINCT FROM old_state;

UPDATE public.jobs j SET state = COALESCE(
  (SELECT c.state_uf FROM public.cities c WHERE lower(c.name)=lower(j.city) LIMIT 1),
  public.normalize_uf(j.state), '')
WHERE j.state IS NOT NULL AND (j.state='' OR public.normalize_uf(j.state) IS NULL)
  AND COALESCE((SELECT c.state_uf FROM public.cities c WHERE lower(c.name)=lower(j.city) LIMIT 1),
               public.normalize_uf(j.state), '') IS DISTINCT FROM j.state;

UPDATE public.profiles SET state = COALESCE(public.normalize_uf(state), '')
WHERE state IS NOT NULL AND state IS DISTINCT FROM COALESCE(public.normalize_uf(state),'');
UPDATE public.agencies SET state = COALESCE(public.normalize_uf(state), '')
WHERE state IS NOT NULL AND state IS DISTINCT FROM COALESCE(public.normalize_uf(state),'');
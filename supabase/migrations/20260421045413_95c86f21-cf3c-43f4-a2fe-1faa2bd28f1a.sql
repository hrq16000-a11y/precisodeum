
-- =========================================================
-- P0.3 — Portabilidade absoluta: user_ref em sponsors e agencies
-- =========================================================

-- Helper: deriva user_ref curto e estável a partir do uuid do dono.
-- Usa o mesmo padrão já existente em profiles.user_ref (8-4-4-4-12 reduzido).
CREATE OR REPLACE FUNCTION public.derive_user_ref(_user_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN NULL
    ELSE substr(replace(_user_id::text, '-', ''), 1, 4)
         || '-' ||
         substr(replace(_user_id::text, '-', ''), 5, 4)
         || '-' ||
         substr(replace(_user_id::text, '-', ''), 9, 4)
         || '-' ||
         substr(replace(_user_id::text, '-', ''), 13, 4)
  END
$$;

-- ---------- AGENCIES ----------
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS user_ref text;

-- Backfill para registros existentes
UPDATE public.agencies
SET user_ref = public.derive_user_ref(user_id)
WHERE user_ref IS NULL AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agencies_user_ref ON public.agencies(user_ref);

CREATE OR REPLACE FUNCTION public.set_agency_user_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_ref IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.user_ref := public.derive_user_ref(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_agency_user_ref ON public.agencies;
CREATE TRIGGER trg_set_agency_user_ref
BEFORE INSERT OR UPDATE OF user_id ON public.agencies
FOR EACH ROW
EXECUTE FUNCTION public.set_agency_user_ref();

-- ---------- SPONSORS ----------
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS user_ref text;

UPDATE public.sponsors
SET user_ref = public.derive_user_ref(user_id)
WHERE user_ref IS NULL AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sponsors_user_ref ON public.sponsors(user_ref);

CREATE OR REPLACE FUNCTION public.set_sponsor_user_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_ref IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.user_ref := public.derive_user_ref(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_sponsor_user_ref ON public.sponsors;
CREATE TRIGGER trg_set_sponsor_user_ref
BEFORE INSERT OR UPDATE OF user_id ON public.sponsors
FOR EACH ROW
EXECUTE FUNCTION public.set_sponsor_user_ref();

-- =========================================================
-- P0.4 — God Mode: RLS Admin em agencies + correção sponsors
-- =========================================================

-- AGENCIES — Admin policies
DROP POLICY IF EXISTS "Admins can view all agencies" ON public.agencies;
CREATE POLICY "Admins can view all agencies"
ON public.agencies
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update agencies" ON public.agencies;
CREATE POLICY "Admins can update agencies"
ON public.agencies
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete agencies" ON public.agencies;
CREATE POLICY "Admins can delete agencies"
ON public.agencies
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- SPONSORS — Fechar brecha do INSERT (with_check faltante)
DROP POLICY IF EXISTS "Admins can insert sponsors" ON public.sponsors;
CREATE POLICY "Admins can insert sponsors"
ON public.sponsors
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

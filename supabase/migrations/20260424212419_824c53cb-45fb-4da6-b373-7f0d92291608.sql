CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tax_id_encrypted bytea,
  ADD COLUMN IF NOT EXISTS tax_id_last4 text,
  ADD COLUMN IF NOT EXISTS tax_id_kind text;

CREATE OR REPLACE FUNCTION public.validate_profile_tax_id_secure()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  IF NEW.tax_id IS NULL OR NEW.tax_id = '' THEN
    NEW.tax_id := NULL;
    NEW.tax_id_last4 := NULL;
    NEW.tax_id_kind := NULL;
    RETURN NEW;
  END IF;

  digits := regexp_replace(NEW.tax_id, '\D', '', 'g');

  IF length(digits) NOT IN (11, 14) THEN
    RAISE EXCEPTION 'tax_id deve conter 11 dígitos (CPF) ou 14 (CNPJ)';
  END IF;

  NEW.tax_id := NULL;
  NEW.tax_id_last4 := right(digits, 4);
  NEW.tax_id_kind := CASE WHEN length(digits) = 14 THEN 'cnpj' ELSE 'cpf' END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_profile_tax_id ON public.profiles;
CREATE TRIGGER trg_validate_profile_tax_id
  BEFORE INSERT OR UPDATE OF tax_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_tax_id_secure();

CREATE OR REPLACE FUNCTION public.set_profile_tax_id(_tax_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_digits text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF _tax_id IS NULL OR btrim(_tax_id) = '' THEN
    UPDATE public.profiles
    SET tax_id = NULL,
        tax_id_encrypted = NULL,
        tax_id_last4 = NULL,
        tax_id_kind = NULL,
        updated_at = now()
    WHERE id = v_user_id;
    RETURN;
  END IF;

  v_digits := regexp_replace(_tax_id, '\D', '', 'g');

  IF length(v_digits) NOT IN (11, 14) THEN
    RAISE EXCEPTION 'CPF/CNPJ inválido';
  END IF;

  UPDATE public.profiles
  SET tax_id = v_digits,
      tax_id_encrypted = pgp_sym_encrypt(v_digits, current_setting('app.settings.jwt_secret', true)),
      tax_id_last4 = right(v_digits, 4),
      tax_id_kind = CASE WHEN length(v_digits) = 14 THEN 'cnpj' ELSE 'cpf' END,
      updated_at = now()
  WHERE id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_profile_tax_id(_profile_id uuid, _tax_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF _tax_id IS NULL OR btrim(_tax_id) = '' THEN
    UPDATE public.profiles
    SET tax_id = NULL,
        tax_id_encrypted = NULL,
        tax_id_last4 = NULL,
        tax_id_kind = NULL,
        updated_at = now()
    WHERE id = _profile_id;
    RETURN;
  END IF;

  v_digits := regexp_replace(_tax_id, '\D', '', 'g');

  IF length(v_digits) NOT IN (11, 14) THEN
    RAISE EXCEPTION 'CPF/CNPJ inválido';
  END IF;

  UPDATE public.profiles
  SET tax_id = v_digits,
      tax_id_encrypted = pgp_sym_encrypt(v_digits, current_setting('app.settings.jwt_secret', true)),
      tax_id_last4 = right(v_digits, 4),
      tax_id_kind = CASE WHEN length(v_digits) = 14 THEN 'cnpj' ELSE 'cpf' END,
      updated_at = now()
  WHERE id = _profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_tax_id(_profile_id uuid DEFAULT auth.uid())
RETURNS TABLE(profile_id uuid, tax_id text, tax_id_kind text, tax_id_last4 text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF _profile_id IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT p.id,
         CASE
           WHEN p.tax_id_encrypted IS NOT NULL THEN pgp_sym_decrypt(p.tax_id_encrypted, current_setting('app.settings.jwt_secret', true))
           ELSE NULL
         END AS tax_id,
         p.tax_id_kind,
         p.tax_id_last4
  FROM public.profiles p
  WHERE p.id = _profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_profile_tax_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_profile_tax_id(text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_profile_tax_id(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_tax_id(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_profile_tax_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_tax_id(uuid) TO authenticated;

UPDATE public.profiles
SET tax_id_encrypted = pgp_sym_encrypt(tax_id, current_setting('app.settings.jwt_secret', true)),
    tax_id_last4 = right(tax_id, 4),
    tax_id_kind = CASE WHEN length(tax_id) = 14 THEN 'cnpj' ELSE 'cpf' END
WHERE tax_id IS NOT NULL
  AND tax_id <> ''
  AND tax_id_encrypted IS NULL;

DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT id, full_name, avatar_url FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
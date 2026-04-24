CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pgcrypto SET SCHEMA extensions;

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
      tax_id_encrypted = extensions.pgp_sym_encrypt(v_digits, current_setting('app.settings.jwt_secret', true)),
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
      tax_id_encrypted = extensions.pgp_sym_encrypt(v_digits, current_setting('app.settings.jwt_secret', true)),
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
           WHEN p.tax_id_encrypted IS NOT NULL THEN extensions.pgp_sym_decrypt(p.tax_id_encrypted, current_setting('app.settings.jwt_secret', true))
           ELSE NULL
         END AS tax_id,
         p.tax_id_kind,
         p.tax_id_last4
  FROM public.profiles p
  WHERE p.id = _profile_id;
END;
$$;

UPDATE public.profiles
SET tax_id_encrypted = extensions.pgp_sym_encrypt(tax_id, current_setting('app.settings.jwt_secret', true)),
    tax_id_last4 = right(tax_id, 4),
    tax_id_kind = CASE WHEN length(tax_id) = 14 THEN 'cnpj' ELSE 'cpf' END
WHERE tax_id IS NOT NULL
  AND tax_id <> ''
  AND tax_id_encrypted IS NULL;
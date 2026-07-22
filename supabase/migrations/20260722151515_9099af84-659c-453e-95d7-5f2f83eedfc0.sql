
-- P1 · Hardening do fluxo de cadastro
-- 1) handle_new_user: substitui log silencioso por auditoria em system_audit_logs
-- 2) check_tax_id_duplicate: RPC segura para checagem de CPF/CNPJ duplicado
--    sem expor tax_id bruto ao cliente.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_full_name TEXT;
  v_avatar    TEXT;
  v_phone     TEXT;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
  v_phone := NEW.raw_user_meta_data->>'phone';

  INSERT INTO public.profiles (id, full_name, avatar_url, phone, email)
  VALUES (NEW.id, v_full_name, v_avatar, v_phone, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Auditoria estruturada da falha; NUNCA quebra o signup.
  BEGIN
    INSERT INTO public.system_audit_logs (
      staff_id, action, entity_type, entity_id, target_user_id,
      new_values, context_metadata
    ) VALUES (
      NULL,
      'handle_new_user_failed',
      'auth.users',
      NEW.id::text,
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'has_meta', NEW.raw_user_meta_data IS NOT NULL
      ),
      jsonb_build_object(
        'sqlstate', SQLSTATE,
        'sqlerrm',  SQLERRM
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- fallback: apenas WARNING; auditoria não pode derrubar o signup
    RAISE WARNING 'handle_new_user audit-log failed for %: %', NEW.id, SQLERRM;
  END;
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- RPC pública para checagem de duplicidade de CPF/CNPJ sem SELECT direto na tabela.
CREATE OR REPLACE FUNCTION public.check_tax_id_duplicate(
  _digits text,
  _ignore_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_clean text;
  v_len   int;
  v_kind  text;
  v_last4 text;
  v_count int;
BEGIN
  v_clean := regexp_replace(COALESCE(_digits, ''), '\D', '', 'g');
  v_len   := length(v_clean);

  IF v_len NOT IN (11, 14) THEN
    RETURN false;
  END IF;

  v_kind  := CASE WHEN v_len = 11 THEN 'cpf' ELSE 'cnpj' END;
  v_last4 := right(v_clean, 4);

  SELECT count(*)
    INTO v_count
    FROM public.profiles p
   WHERE p.tax_id_last4 = v_last4
     AND p.tax_id_kind  = v_kind
     AND (_ignore_user_id IS NULL OR p.id <> _ignore_user_id)
     AND (p.tax_id IS NULL OR p.tax_id = v_clean);

  RETURN v_count > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.check_tax_id_duplicate(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_tax_id_duplicate(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_tax_id_duplicate(text, uuid) TO anon;

COMMENT ON FUNCTION public.check_tax_id_duplicate(text, uuid) IS
'Checagem de duplicidade CPF/CNPJ sem expor tax_id ao cliente. Combina last4 + kind e, quando disponível, confirma com tax_id exato via SECURITY DEFINER.';

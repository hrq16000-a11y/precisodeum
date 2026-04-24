-- 1) Função handle_new_user: cria profile automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_avatar TEXT;
  v_phone TEXT;
BEGIN
  -- Extrai dados do raw_user_meta_data (OAuth/email)
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

  -- Insert idempotente (evita conflito se já existir)
  INSERT INTO public.profiles (id, full_name, avatar_url, phone, email)
  VALUES (NEW.id, v_full_name, v_avatar, v_phone, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca quebra o signup; apenas loga
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 2) Trigger no auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3) RPC: listar perfis órfãos (admin only)
CREATE OR REPLACE FUNCTION public.admin_list_orphan_profiles()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  raw_user_meta_data JSONB,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::TEXT, u.created_at, u.raw_user_meta_data, u.last_sign_in_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL
  ORDER BY u.created_at DESC
  LIMIT 500;
END;
$$;

-- 4) RPC: reprocessar 1 perfil órfão (admin only)
CREATE OR REPLACE FUNCTION public.admin_reconcile_orphan_profile(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_full_name TEXT;
  v_avatar TEXT;
  v_phone TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  SELECT id, email, raw_user_meta_data
  INTO v_user
  FROM auth.users
  WHERE id = _user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user not found in auth.users');
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('success', true, 'message', 'profile already exists', 'created', false);
  END IF;

  v_full_name := COALESCE(
    v_user.raw_user_meta_data->>'full_name',
    v_user.raw_user_meta_data->>'name',
    split_part(v_user.email, '@', 1)
  );
  v_avatar := COALESCE(
    v_user.raw_user_meta_data->>'avatar_url',
    v_user.raw_user_meta_data->>'picture'
  );
  v_phone := v_user.raw_user_meta_data->>'phone';

  INSERT INTO public.profiles (id, full_name, avatar_url, phone, email)
  VALUES (_user_id, v_full_name, v_avatar, v_phone, v_user.email)
  ON CONFLICT (id) DO NOTHING;

  -- Auditoria
  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'reconcile_orphan_profile',
    'profile',
    _user_id::TEXT,
    jsonb_build_object('email', v_user.email, 'full_name', v_full_name)
  );

  RETURN jsonb_build_object('success', true, 'created', true, 'user_id', _user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_orphan_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_orphan_profile(UUID) TO authenticated;
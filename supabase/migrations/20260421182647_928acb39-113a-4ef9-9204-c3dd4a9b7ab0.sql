-- ============================================================
-- BACKEND HARDENING: Limit validation in atomic RPCs
-- create_album_atomic + add_portfolio_photo_atomic now consult
-- site_settings (portfolio_max_albums, portfolio_max_photos_per_album)
-- and reject creation if user exceeds the configured limit.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_album_atomic(
  _name text,
  _description text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_provider RECORD;
  v_album_id uuid;
  v_display_order int;
  v_max_albums int;
  v_current_count int;
  v_setting_value text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id, user_ref INTO v_provider
    FROM public.providers
   WHERE user_id = v_user_id AND deleted_at IS NULL
   LIMIT 1;

  IF v_provider.id IS NULL THEN
    RAISE EXCEPTION 'Perfil profissional não encontrado';
  END IF;

  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Nome do álbum é obrigatório';
  END IF;

  -- Server-side limit enforcement
  SELECT value INTO v_setting_value
    FROM public.site_settings
   WHERE key = 'portfolio_max_albums'
   LIMIT 1;
  v_max_albums := COALESCE(NULLIF(v_setting_value, '')::int, 4);

  SELECT COUNT(*)::int INTO v_current_count
    FROM public.portfolio_albums
   WHERE provider_id = v_provider.id;

  IF v_current_count >= v_max_albums THEN
    RAISE EXCEPTION 'Limite de % álbuns atingido. Remova um álbum existente para criar outro.', v_max_albums
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(MAX(display_order), -1) + 1
    INTO v_display_order
    FROM public.portfolio_albums
   WHERE provider_id = v_provider.id;

  INSERT INTO public.portfolio_albums (
    provider_id, user_id, user_ref, name, description, display_order
  ) VALUES (
    v_provider.id, v_user_id, v_provider.user_ref,
    trim(_name), COALESCE(trim(_description), ''), v_display_order
  )
  RETURNING id INTO v_album_id;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    v_user_id, 'album_create_atomic', 'portfolio_album', v_album_id::text,
    jsonb_build_object(
      'provider_id', v_provider.id,
      'user_ref', v_provider.user_ref,
      'name', trim(_name)
    )
  );

  RETURN jsonb_build_object(
    'id', v_album_id,
    'provider_id', v_provider.id,
    'user_ref', v_provider.user_ref
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_portfolio_photo_atomic(
  _album_id uuid,
  _image_url text,
  _storage_path text,
  _original_name text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_album RECORD;
  v_photo_id uuid;
  v_display_order int;
  v_max_photos int;
  v_current_count int;
  v_setting_value text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT a.*, p.user_ref AS provider_user_ref, p.user_id AS provider_user_id
    INTO v_album
    FROM public.portfolio_albums a
    JOIN public.providers p ON p.id = a.provider_id
   WHERE a.id = _album_id;

  IF v_album.id IS NULL THEN
    RAISE EXCEPTION 'Álbum não encontrado';
  END IF;

  IF v_album.provider_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Acesso negado: álbum pertence a outro usuário';
  END IF;

  -- Server-side limit enforcement
  SELECT value INTO v_setting_value
    FROM public.site_settings
   WHERE key = 'portfolio_max_photos_per_album'
   LIMIT 1;
  v_max_photos := COALESCE(NULLIF(v_setting_value, '')::int, 20);

  SELECT COUNT(*)::int INTO v_current_count
    FROM public.portfolio_photos
   WHERE album_id = _album_id;

  IF v_current_count >= v_max_photos THEN
    RAISE EXCEPTION 'Limite de % fotos por álbum atingido.', v_max_photos
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(MAX(display_order), -1) + 1
    INTO v_display_order
    FROM public.portfolio_photos
   WHERE album_id = _album_id;

  INSERT INTO public.portfolio_photos (
    album_id, user_id, user_ref, image_url, storage_path, original_name, display_order
  ) VALUES (
    _album_id, v_user_id, v_album.provider_user_ref,
    _image_url, COALESCE(_storage_path, ''), COALESCE(_original_name, ''), v_display_order
  )
  RETURNING id INTO v_photo_id;

  IF v_album.cover_image_url IS NULL OR v_album.cover_image_url = '' THEN
    UPDATE public.portfolio_albums
       SET cover_image_url = _image_url
     WHERE id = _album_id;
  END IF;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    v_user_id, 'portfolio_photo_atomic', 'portfolio_photo', v_photo_id::text,
    jsonb_build_object(
      'album_id', _album_id,
      'provider_id', v_album.provider_id,
      'user_ref', v_album.provider_user_ref
    )
  );

  RETURN jsonb_build_object(
    'id', v_photo_id,
    'album_id', _album_id,
    'user_ref', v_album.provider_user_ref,
    'display_order', v_display_order
  );
END;
$$;
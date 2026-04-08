CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url, level_id, account_type_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    '716c417b-fdc8-4121-879b-abcd8f0a216f',
    '50a97ea2-c43e-472f-b6f2-4dd180379cad'
  );
  RETURN NEW;
END;
$$;
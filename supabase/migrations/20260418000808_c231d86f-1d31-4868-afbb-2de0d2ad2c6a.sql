-- Desabilita trigger problematica temporariamente para o bulk update
ALTER TABLE public.profiles DISABLE TRIGGER USER;

-- 1. Migrar profiles existentes para os 2 tipos consolidados
UPDATE public.profiles
SET account_type_id = '61f51480-d8c2-4c78-8f44-6a17e8b6b968'
WHERE account_type_id IS NULL
   OR account_type_id IN (
     '50a97ea2-c43e-472f-b6f2-4dd180379cad',
     'fa7008b8-3fcd-4a34-935e-ac591f1b3989',
     '820fab4d-caed-49af-b7b6-97b69a5a06fb'
   );

-- 2. Renomear/desativar
UPDATE public.account_types SET name = 'Profissional Autônomo', description = 'Profissional individual ou autônomo', display_order = 1, color = '#6b7280', active = true
WHERE id = '61f51480-d8c2-4c78-8f44-6a17e8b6b968';

UPDATE public.account_types SET name = 'Empresa / Agência', description = 'Empresa, agência de RH ou pessoa jurídica', display_order = 2, color = '#7c3aed', active = true
WHERE id = '4e322d19-c999-4563-ac63-45ccefd78736';

UPDATE public.account_types SET active = false
WHERE id IN ('50a97ea2-c43e-472f-b6f2-4dd180379cad', 'fa7008b8-3fcd-4a34-935e-ac591f1b3989', '820fab4d-caed-49af-b7b6-97b69a5a06fb');

-- 3. Default
ALTER TABLE public.profiles
  ALTER COLUMN account_type_id SET DEFAULT '61f51480-d8c2-4c78-8f44-6a17e8b6b968';

-- 4. onboarding_completed
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- 5. Corrigir Rodrigo
UPDATE public.profiles
SET created_at = now()
WHERE id = '53ff8883-d982-42a1-bc3a-f19c7f233971';

-- Reabilita triggers
ALTER TABLE public.profiles ENABLE TRIGGER USER;

-- 6. handle_new_user usa default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_default_level uuid;
BEGIN
  SELECT id INTO v_default_level
  FROM public.gamification_levels
  WHERE active = true
  ORDER BY min_points ASC
  LIMIT 1;

  INSERT INTO public.profiles (id, full_name, email, avatar_url, level_id, account_type_id, profile_type, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    v_default_level,
    '61f51480-d8c2-4c78-8f44-6a17e8b6b968',
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'profile_type', ''), 'client'),
    CASE
      WHEN NEW.raw_user_meta_data ->> 'profile_type' = 'rh' THEN 'client'
      WHEN NEW.raw_user_meta_data ->> 'profile_type' IS NOT NULL THEN NEW.raw_user_meta_data ->> 'profile_type'
      ELSE 'client'
    END
  );
  RETURN NEW;
END;
$$;

-- 7. user_access_logs
CREATE TABLE IF NOT EXISTS public.user_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'login',
  ip_address text,
  isp text,
  country text,
  region text,
  city text,
  user_agent text,
  device_type text,
  os text,
  browser text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_access_logs_user ON public.user_access_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_access_logs_created ON public.user_access_logs(created_at DESC);

ALTER TABLE public.user_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all access logs" ON public.user_access_logs;
CREATE POLICY "Admins can view all access logs"
  ON public.user_access_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view their own access logs" ON public.user_access_logs;
CREATE POLICY "Users can view their own access logs"
  ON public.user_access_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert access logs" ON public.user_access_logs;
CREATE POLICY "Service role can insert access logs"
  ON public.user_access_logs FOR INSERT
  WITH CHECK (true);
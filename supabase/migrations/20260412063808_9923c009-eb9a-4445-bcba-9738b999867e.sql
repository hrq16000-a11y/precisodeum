
-- Add tier_key to account_types to create explicit mapping
ALTER TABLE public.account_types ADD COLUMN IF NOT EXISTS tier_key text DEFAULT 'free';

-- Populate tier_key for existing account types
UPDATE public.account_types SET tier_key = 'premium' WHERE id = 'fa7008b8-3fcd-4a34-935e-ac591f1b3989'; -- Premium
UPDATE public.account_types SET tier_key = 'premium' WHERE id = '820fab4d-caed-49af-b7b6-97b69a5a06fb'; -- Enterprise
UPDATE public.account_types SET tier_key = 'free' WHERE id = '50a97ea2-c43e-472f-b6f2-4dd180379cad'; -- Trial
UPDATE public.account_types SET tier_key = 'free' WHERE id = '61f51480-d8c2-4c78-8f44-6a17e8b6b968'; -- Basic
UPDATE public.account_types SET tier_key = 'free' WHERE id = '4e322d19-c999-4563-ac63-45ccefd78736'; -- Agencia de RH

-- Create trigger function to sync provider plan when account_type changes
CREATE OR REPLACE FUNCTION public.sync_provider_plan_on_account_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tier_key text;
  v_provider_plan text;
  v_featured boolean;
BEGIN
  -- Only act when account_type_id actually changes
  IF NEW.account_type_id IS NOT DISTINCT FROM OLD.account_type_id THEN
    RETURN NEW;
  END IF;

  -- Look up the tier_key for the new account type
  SELECT at.tier_key INTO v_tier_key
  FROM account_types at
  WHERE at.id = NEW.account_type_id;

  -- If no mapping found, do nothing
  IF v_tier_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine provider plan and featured status
  IF v_tier_key = 'premium' THEN
    v_provider_plan := 'premium';
    v_featured := true;
  ELSE
    v_provider_plan := 'free';
    v_featured := false;
  END IF;

  -- Update the provider record linked to this profile
  UPDATE providers
  SET plan = v_provider_plan,
      featured = v_featured,
      updated_at = now()
  WHERE user_id = NEW.id
    AND deleted_at IS NULL;

  -- Log the change in audit
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    NEW.id,
    'plan_synced',
    'profile',
    NEW.id::text,
    jsonb_build_object(
      'old_account_type_id', OLD.account_type_id,
      'new_account_type_id', NEW.account_type_id,
      'tier_key', v_tier_key,
      'provider_plan', v_provider_plan
    )
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to profiles table
DROP TRIGGER IF EXISTS trg_sync_provider_plan ON public.profiles;
CREATE TRIGGER trg_sync_provider_plan
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_provider_plan_on_account_change();

-- Also update account_model_view to consider account_types.tier_key as fallback
CREATE OR REPLACE VIEW public.account_model_view AS
SELECT 
  p.user_ref,
  p.email,
  p.profile_type,
  COALESCE(pr.plan, 'free') AS plan,
  CASE
    WHEN pr.plan = 'premium' THEN 'premium'
    WHEN at.tier_key = 'premium' THEN 'premium'
    WHEN p.profile_type = 'provider' THEN 'free_provider'
    WHEN p.profile_type = 'client' THEN 'free_client'
    WHEN p.profile_type = 'rh' THEN 'free_rh'
    ELSE 'other'
  END AS account_tier,
  CASE
    WHEN pr.plan = 'premium' OR at.tier_key = 'premium' THEN true
    ELSE false
  END AS is_premium,
  CASE
    WHEN p.profile_type = 'provider' THEN true
    ELSE false
  END AS is_provider,
  CASE
    WHEN p.profile_type = 'rh' THEN true
    ELSE false
  END AS is_rh
FROM profiles p
LEFT JOIN providers pr ON pr.user_id = p.id
LEFT JOIN account_types at ON at.id = p.account_type_id;

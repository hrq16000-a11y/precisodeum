CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and service_role bypass
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.permissions IS DISTINCT FROM OLD.permissions
     OR NEW.staff_role IS DISTINCT FROM OLD.staff_role
     OR NEW.account_type_id IS DISTINCT FROM OLD.account_type_id
     OR NEW.commercial_plan IS DISTINCT FROM OLD.commercial_plan
     OR NEW.engagement_points IS DISTINCT FROM OLD.engagement_points
  THEN
    RAISE EXCEPTION 'cannot modify privileged profile columns'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins e service_role bypass total
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Vetores REAIS de escalada de privilégio (nunca devem ser mudados pelo dono)
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.permissions IS DISTINCT FROM OLD.permissions
     OR NEW.staff_role IS DISTINCT FROM OLD.staff_role
     OR NEW.commercial_plan IS DISTINCT FROM OLD.commercial_plan
  THEN
    RAISE EXCEPTION 'cannot modify privileged profile columns'
      USING ERRCODE = '42501';
  END IF;

  -- account_type_id e engagement_points: são gravados legitimamente pelo próprio
  -- fluxo de onboarding (define PF/PJ) e pela gamificação (Bet Mode soma pontos).
  -- Removidos da guarda para não bloquear o Cadastro Express.

  RETURN NEW;
END;
$$;

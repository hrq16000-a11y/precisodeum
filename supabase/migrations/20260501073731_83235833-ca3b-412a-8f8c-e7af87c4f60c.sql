-- Backfill: prestadores com serviços já cadastrados devem ter onboarding marcado como concluído
UPDATE public.profiles p
SET onboarding_completed = true,
    onboarding_step = GREATEST(COALESCE(p.onboarding_step, 0), 5),
    updated_at = now()
WHERE p.profile_type = 'provider'
  AND COALESCE(p.onboarding_completed, false) = false
  AND EXISTS (
    SELECT 1
    FROM public.providers pr
    JOIN public.services s ON s.provider_id = pr.id
    WHERE pr.user_id = p.id
  );
UPDATE public.profiles p
SET profile_type = 'provider', updated_at = now()
WHERE p.profile_type IS NULL
  AND EXISTS (SELECT 1 FROM public.providers pr WHERE pr.user_id = p.id);
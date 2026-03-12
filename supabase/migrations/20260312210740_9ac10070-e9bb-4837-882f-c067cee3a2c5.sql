
-- Fix permissive INSERT on leads: require at least a valid provider_id
DROP POLICY "Anyone can create leads" ON public.leads;
CREATE POLICY "Anyone can create leads" ON public.leads FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.providers WHERE id = provider_id AND status = 'approved')
  );

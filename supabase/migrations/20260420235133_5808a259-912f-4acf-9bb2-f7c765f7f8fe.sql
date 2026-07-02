UPDATE public.site_settings 
SET value = '"/lovable-uploads/logo-pdup-v3.png"'::jsonb, 
    updated_at = now() 
WHERE key = 'logo_url';
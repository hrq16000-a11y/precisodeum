
-- Add granular permissions to sponsor_contacts
ALTER TABLE public.sponsor_contacts
ADD COLUMN permissions jsonb NOT NULL DEFAULT '{
  "banners": true,
  "campanhas": true,
  "metricas": true,
  "contratos": true,
  "notificacoes": true,
  "dados": true
}'::jsonb;

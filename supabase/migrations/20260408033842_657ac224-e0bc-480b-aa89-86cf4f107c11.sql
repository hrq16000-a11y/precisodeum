
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{
  "dashboard": true,
  "profile": true,
  "services": true,
  "my_page": true,
  "jobs": true,
  "community": true,
  "notifications": true,
  "leads": true,
  "plan": true,
  "reviews": true,
  "admin_panel": true,
  "sponsor_panel": true
}'::jsonb;

ALTER TABLE public.profiles 
ALTER COLUMN permissions 
SET DEFAULT '{"jobs":true,"plan":true,"leads":true,"my_page":true,"profile":true,"reviews":true,"services":true,"community":true,"dashboard":true,"admin_panel":false,"notifications":true,"sponsor_panel":false}'::jsonb;
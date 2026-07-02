
-- Drop functions with CASCADE to also drop dependent triggers
DROP FUNCTION IF EXISTS public.check_upsell_on_service_change() CASCADE;
DROP FUNCTION IF EXISTS public.check_upsell_on_lead_insert() CASCADE;

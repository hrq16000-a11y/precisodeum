-- 1. Expand tier_rules with SaaS control columns
ALTER TABLE public.tier_rules
  ADD COLUMN max_ads integer NOT NULL DEFAULT 0,
  ADD COLUMN max_slots integer NOT NULL DEFAULT 0,
  ADD COLUMN can_access_crm boolean NOT NULL DEFAULT false,
  ADD COLUMN can_access_reports boolean NOT NULL DEFAULT false,
  ADD COLUMN can_access_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN ranking_priority integer NOT NULL DEFAULT 0,
  ADD COLUMN search_boost integer NOT NULL DEFAULT 0;

-- 2. Add account_type_id to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN account_type_id uuid REFERENCES public.account_types(id);

-- 3. Recreate account_limits_view with new tier_rules columns
CREATE OR REPLACE VIEW public.account_limits_view AS
SELECT
  amv.user_ref,
  amv.email,
  amv.account_tier,
  COALESCE(tr.max_services, 0) AS max_services,
  COALESCE(tr.max_leads, 0) AS max_leads,
  COALESCE(tr.can_receive_leads, false) AS can_receive_leads,
  COALESCE(tr.can_create_services, false) AS can_create_services,
  COALESCE(tr.max_ads, 0) AS max_ads,
  COALESCE(tr.max_slots, 0) AS max_slots,
  COALESCE(tr.can_access_crm, false) AS can_access_crm,
  COALESCE(tr.can_access_reports, false) AS can_access_reports,
  COALESCE(tr.can_access_featured, false) AS can_access_featured,
  COALESCE(tr.ranking_priority, 0) AS ranking_priority,
  COALESCE(tr.search_boost, 0) AS search_boost
FROM account_model_view amv
LEFT JOIN tier_rules tr ON tr.tier_key = amv.account_tier;
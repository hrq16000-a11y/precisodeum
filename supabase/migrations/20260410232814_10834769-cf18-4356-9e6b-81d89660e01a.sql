
-- =========================================================
-- GOVERNANCE ENGINE TABLES
-- =========================================================

CREATE TABLE public.governance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('storage', 'sil', 'geo', 'ui', 'auth', 'ranking', 'global')),
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'testing')),
  version integer NOT NULL DEFAULT 1,
  description text DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scope, key)
);

ALTER TABLE public.governance_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage governance rules"
ON public.governance_rules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_governance_rules_updated_at
BEFORE UPDATE ON public.governance_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================

CREATE TABLE public.governance_changes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.governance_rules(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  before_value jsonb,
  after_value jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.governance_changes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view governance changes"
ON public.governance_changes_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert governance changes"
ON public.governance_changes_log FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =========================================================

CREATE TABLE public.governance_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.governance_rules(id) ON DELETE CASCADE,
  requested_by uuid,
  approved_by uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason text DEFAULT '',
  proposed_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.governance_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage governance approvals"
ON public.governance_approvals FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- SYSTEM INTEGRITY ENGINE TABLES
-- =========================================================

CREATE TABLE public.system_drift_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('schema', 'policy', 'ui', 'api', 'engine')),
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false,
  resolution_note text
);

ALTER TABLE public.system_drift_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage drift reports"
ON public.system_drift_reports FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================

CREATE TABLE public.system_contract_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('table', 'view', 'component', 'engine', 'function')),
  entity_name text NOT NULL UNIQUE,
  contract_json jsonb NOT NULL DEFAULT '{}',
  last_verified_at timestamptz,
  status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('valid', 'invalid', 'unverified')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_contract_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage contract map"
ON public.system_contract_map FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- RUNTIME STABILITY ENGINE TABLES
-- =========================================================

CREATE TABLE public.runtime_component_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_name text NOT NULL UNIQUE,
  failure_count integer NOT NULL DEFAULT 0,
  last_error text,
  status text NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'failing')),
  last_checked_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.runtime_component_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage component health"
ON public.runtime_component_health FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow any authenticated user to report errors
CREATE POLICY "Authenticated users can report component errors"
ON public.runtime_component_health FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can insert component health"
ON public.runtime_component_health FOR INSERT TO authenticated
WITH CHECK (true);

-- =========================================================

CREATE TABLE public.runtime_fallback_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL UNIQUE,
  fallback_type text NOT NULL DEFAULT 'skeleton' CHECK (fallback_type IN ('skeleton', 'retry', 'redirect', 'null_safe', 'error_boundary')),
  strategy_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.runtime_fallback_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fallback registry"
ON public.runtime_fallback_registry FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can read fallback registry"
ON public.runtime_fallback_registry FOR SELECT TO authenticated
USING (true);

CREATE TRIGGER update_fallback_registry_updated_at
BEFORE UPDATE ON public.runtime_fallback_registry
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- AUTO-LOG GOVERNANCE CHANGES TRIGGER
-- =========================================================

CREATE OR REPLACE FUNCTION public.log_governance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO governance_changes_log (rule_id, action, after_value, user_id)
    VALUES (NEW.id, 'create', to_jsonb(NEW), NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO governance_changes_log (rule_id, action, before_value, after_value, user_id)
    VALUES (NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW), NEW.created_by);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO governance_changes_log (rule_id, action, before_value, user_id)
    VALUES (OLD.id, 'delete', to_jsonb(OLD), OLD.created_by);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_governance_changes
AFTER INSERT OR UPDATE OR DELETE ON public.governance_rules
FOR EACH ROW EXECUTE FUNCTION public.log_governance_change();

-- 1) Telemetria do Onboarding V2
CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT 'v2',     -- 'v1' | 'v2'
  phase TEXT NOT NULL,                    -- ex: phase1_action, phase2_service
  event TEXT NOT NULL,                    -- enter|next|back|skip|submit|error|abandon|complete
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_onb_events_user ON public.onboarding_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onb_events_session ON public.onboarding_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onb_events_variant_phase ON public.onboarding_events(variant, phase, event);

ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

-- Anon e auth podem inserir (telemetria precisa funcionar antes do login)
DROP POLICY IF EXISTS "anyone can insert telemetry" ON public.onboarding_events;
CREATE POLICY "anyone can insert telemetry"
  ON public.onboarding_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- não permite forjar user_id de terceiros
    user_id IS NULL OR user_id = auth.uid()
  );

-- Apenas admin lê
DROP POLICY IF EXISTS "admins read telemetry" ON public.onboarding_events;
CREATE POLICY "admins read telemetry"
  ON public.onboarding_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Sync remoto do rascunho (cross-device)
CREATE TABLE IF NOT EXISTS public.onboarding_v2_drafts (
  user_id UUID PRIMARY KEY,
  payload JSONB NOT NULL,
  phase TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_v2_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user reads own draft" ON public.onboarding_v2_drafts;
CREATE POLICY "user reads own draft"
  ON public.onboarding_v2_drafts FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user upserts own draft" ON public.onboarding_v2_drafts;
CREATE POLICY "user upserts own draft"
  ON public.onboarding_v2_drafts FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user updates own draft" ON public.onboarding_v2_drafts;
CREATE POLICY "user updates own draft"
  ON public.onboarding_v2_drafts FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user deletes own draft" ON public.onboarding_v2_drafts;
CREATE POLICY "user deletes own draft"
  ON public.onboarding_v2_drafts FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_onboarding_v2_draft()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_touch_onboarding_v2_draft ON public.onboarding_v2_drafts;
CREATE TRIGGER trg_touch_onboarding_v2_draft
BEFORE UPDATE ON public.onboarding_v2_drafts
FOR EACH ROW EXECUTE FUNCTION public.touch_onboarding_v2_draft();

-- 3) Feature flag de rollout (0..100 = % de novos usuários no V2)
INSERT INTO public.site_settings (key, value)
VALUES ('onboarding_v2_rollout_percent', '0')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, value)
VALUES ('onboarding_v2_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
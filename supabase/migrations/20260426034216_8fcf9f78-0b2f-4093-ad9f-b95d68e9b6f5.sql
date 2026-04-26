-- Tabela de preferências de alerta de novos leads por usuário
CREATE TABLE IF NOT EXISTS public.lead_alert_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'both' CHECK (mode IN ('off', 'sound', 'toast', 'both')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_alert_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert preferences"
  ON public.lead_alert_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alert preferences"
  ON public.lead_alert_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alert preferences"
  ON public.lead_alert_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own alert preferences"
  ON public.lead_alert_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER trg_lead_alert_preferences_updated_at
  BEFORE UPDATE ON public.lead_alert_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
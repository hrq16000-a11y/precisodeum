CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_templates_user ON public.whatsapp_templates(user_id, created_at DESC);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own templates" ON public.whatsapp_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own templates" ON public.whatsapp_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own templates" ON public.whatsapp_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own templates" ON public.whatsapp_templates
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
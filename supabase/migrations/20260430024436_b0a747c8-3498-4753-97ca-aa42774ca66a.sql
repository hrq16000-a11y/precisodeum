-- Persistência cross-device do rascunho do Bet Mode (triagem do cadastro).
-- Espelha onboarding_v2_drafts mas com payload menor e independente.
CREATE TABLE IF NOT EXISTS public.bet_drafts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  phase text NOT NULL DEFAULT 'identity',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bet_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own bet draft" ON public.bet_drafts;
CREATE POLICY "Users can read own bet draft"
  ON public.bet_drafts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own bet draft" ON public.bet_drafts;
CREATE POLICY "Users can insert own bet draft"
  ON public.bet_drafts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own bet draft" ON public.bet_drafts;
CREATE POLICY "Users can update own bet draft"
  ON public.bet_drafts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own bet draft" ON public.bet_drafts;
CREATE POLICY "Users can delete own bet draft"
  ON public.bet_drafts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.touch_bet_drafts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bet_drafts_touch ON public.bet_drafts;
CREATE TRIGGER trg_bet_drafts_touch
  BEFORE UPDATE ON public.bet_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_bet_drafts_updated_at();

-- Allow each authenticated user to read their own onboarding events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid = 'public.onboarding_events'::regclass AND polname = 'users read own onboarding events'
  ) THEN
    CREATE POLICY "users read own onboarding events"
    ON public.onboarding_events
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;

-- Index to speed up per-user history queries
CREATE INDEX IF NOT EXISTS idx_onboarding_events_user_created
  ON public.onboarding_events (user_id, created_at DESC);

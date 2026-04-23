DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sponsor_subscriptions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;
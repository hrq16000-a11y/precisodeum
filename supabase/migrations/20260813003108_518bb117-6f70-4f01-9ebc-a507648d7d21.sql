DO $$
BEGIN
  PERFORM cron.unschedule('seo-indexation-audit-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'seo-indexation-audit-daily',
  '20 4 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://qaftogrqeyymewoofexc.supabase.co/functions/v1/seo-audit',
    headers := public.get_rss_import_headers(),
    body := '{"sample": 80}'::jsonb,
    timeout_milliseconds := 55000
  );
  $cron$
);
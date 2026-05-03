do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'purge-onboarding-events-daily';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end$$;

select cron.schedule(
  'purge-onboarding-events-daily',
  '0 3 * * *',
  $$select public.purge_onboarding_events();$$
);
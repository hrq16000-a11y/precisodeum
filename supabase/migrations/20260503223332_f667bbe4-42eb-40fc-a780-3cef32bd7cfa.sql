-- Trigger proativo: dispara edge function notify-auth-errors quando um
-- onboarding_event crítico é inserido.

create extension if not exists pg_net with schema extensions;

create or replace function public.trg_notify_auth_errors()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_anon text;
  v_payload jsonb;
begin
  if new.event is distinct from 'error' then
    return new;
  end if;

  if new.error_code is null
     or new.error_code not in ('C_RLS_403', 'B_PROFILE_NULL_HEAL_FAIL') then
    return new;
  end if;

  -- Endpoint da edge function (mesmo projeto)
  v_url := 'https://qaftogrqeyymewoofexc.supabase.co/functions/v1/notify-auth-errors';
  v_anon := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhZnRvZ3JxZXl5bWV3b29mZXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDYwMzMsImV4cCI6MjA4ODkyMjAzM30.nkijGnmbntAiF5syzTxMFF_UZ-IGKDPx1WiHJf_WwGc';

  v_payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'onboarding_events',
    'schema', 'public',
    'record', to_jsonb(new)
  );

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon
    ),
    body := v_payload,
    timeout_milliseconds := 5000
  );

  return new;
exception when others then
  -- Nunca bloquear a inserção do evento por falha no alerta
  raise warning 'trg_notify_auth_errors falhou: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notify_auth_errors_after_insert on public.onboarding_events;

create trigger trg_notify_auth_errors_after_insert
after insert on public.onboarding_events
for each row
execute function public.trg_notify_auth_errors();
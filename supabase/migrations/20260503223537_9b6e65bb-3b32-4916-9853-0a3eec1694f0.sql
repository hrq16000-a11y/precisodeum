-- 1) Tabela de sumário diário (retém estatísticas mesmo após o expurgo)
create table if not exists public.onboarding_events_daily_stats (
  day date not null,
  phase text,
  event text,
  error_code text,
  total_count integer not null default 0,
  unique_users integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (day, phase, event, error_code)
);

alter table public.onboarding_events_daily_stats enable row level security;

drop policy if exists "Admins can read onboarding daily stats" on public.onboarding_events_daily_stats;
create policy "Admins can read onboarding daily stats"
  on public.onboarding_events_daily_stats
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- (sem policies de insert/update/delete: só processos com service role / SECURITY DEFINER escrevem)

create index if not exists idx_onb_events_daily_stats_day on public.onboarding_events_daily_stats (day desc);

-- 2) Índice parcial para acelerar o painel de auth-health
create index if not exists idx_onb_events_error_created
  on public.onboarding_events (created_at desc)
  where event = 'error';

-- 3) Função de manutenção: sumariza dia anterior + expurgo > 90 dias em lotes
create or replace function public.purge_onboarding_events()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - interval '90 days';
  v_summary_day date := (now() - interval '1 day')::date;
  v_summarized integer := 0;
  v_deleted_total integer := 0;
  v_deleted_batch integer := 0;
begin
  -- 3a) Sumariza eventos do dia anterior em onboarding_events_daily_stats (idempotente)
  with agg as (
    select
      created_at::date as day,
      phase,
      event,
      coalesce(meta->>'error_code', meta->>'reason') as error_code,
      count(*) as total_count,
      count(distinct user_id) as unique_users
    from public.onboarding_events
    where created_at >= v_summary_day
      and created_at <  v_summary_day + interval '1 day'
    group by 1, 2, 3, 4
  )
  insert into public.onboarding_events_daily_stats (day, phase, event, error_code, total_count, unique_users)
  select day, phase, event, error_code, total_count, unique_users from agg
  on conflict (day, phase, event, error_code) do update
    set total_count = excluded.total_count,
        unique_users = excluded.unique_users;
  get diagnostics v_summarized = row_count;

  -- 3b) Expurga em lotes de 5000 para não travar a tabela
  loop
    with del as (
      delete from public.onboarding_events
      where ctid in (
        select ctid
        from public.onboarding_events
        where created_at < v_cutoff
        limit 5000
      )
      returning 1
    )
    select count(*) into v_deleted_batch from del;

    v_deleted_total := v_deleted_total + v_deleted_batch;
    exit when v_deleted_batch = 0;
  end loop;

  return jsonb_build_object(
    'cutoff', v_cutoff,
    'summary_day', v_summary_day,
    'summarized_rows', v_summarized,
    'deleted_rows', v_deleted_total,
    'ran_at', now()
  );
end;
$$;

revoke all on function public.purge_onboarding_events() from public, anon, authenticated;
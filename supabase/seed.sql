-- =============================================================================
-- Seed do ambiente LOCAL (supabase start / supabase db reset)
-- Idempotente e defensivo: nunca falha se uma tabela ainda não existir.
-- NÃO é aplicado em produção — o CLI só executa este arquivo em `db reset`.
-- =============================================================================

-- ── 1. Configurações mínimas do site ────────────────────────────────────────
do $$
begin
  if to_regclass('public.site_settings') is null then
    raise notice '[seed] site_settings ausente — pulando';
    return;
  end if;

  insert into public.site_settings (key, value, label, description) values
    ('module_blog',                    'true',  'Blog',                    'Seed local'),
    ('chat_p2p_enabled',               'false', 'Chat P2P',                'Seed local'),
    ('auto_approve_providers',         'true',  'Auto aprovar prestador',  'Seed local: facilita testes'),
    ('onboarding_v2_enabled',          'true',  'Onboarding V2',           'Seed local'),
    ('onboarding_v2_rollout_percent',  '100',   'Rollout onboarding V2',   'Seed local'),
    ('conversion_boost_enabled',       'false', 'Conversion boost',        'Seed local'),
    ('default_search_sort',            'best',  'Ordenação padrão',        'Seed local'),
    ('onboarding_regression_watch_enabled', 'false', 'Regression watch',   'Seed local'),
    ('onboarding_experiments_enabled', 'false', 'Experimentos onboarding', 'Seed local')
  on conflict (key) do nothing;
end $$;

-- ── 2. Usuários de teste (admin + profissional) ─────────────────────────────
-- Senhas: admin123 / pro123
do $$
declare
  v_admin uuid := '00000000-0000-4000-8000-000000000001';
  v_pro   uuid := '00000000-0000-4000-8000-000000000002';
begin
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    create extension if not exists pgcrypto with schema extensions;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values
    ('00000000-0000-0000-0000-000000000000', v_admin, 'authenticated', 'authenticated',
     'admin@local.test', extensions.crypt('admin123', extensions.gen_salt('bf')),
     now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Admin Local"}'::jsonb),
    ('00000000-0000-0000-0000-000000000000', v_pro, 'authenticated', 'authenticated',
     'pro@local.test', extensions.crypt('pro123', extensions.gen_salt('bf')),
     now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Profissional Local"}'::jsonb)
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  select gen_random_uuid(), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email),
         'email', now(), now(), now()
  from auth.users u
  where u.id in (v_admin, v_pro)
    and not exists (
      select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
    );

  -- perfis (o trigger handle_new_user pode já ter criado)
  if to_regclass('public.profiles') is not null then
    insert into public.profiles (id, full_name, email)
    values (v_admin, 'Admin Local', 'admin@local.test'),
           (v_pro,   'Profissional Local', 'pro@local.test')
    on conflict (id) do nothing;
  end if;

  if to_regclass('public.user_roles') is not null then
    insert into public.user_roles (user_id, role)
    values (v_admin, 'admin'), (v_pro, 'user')
    on conflict (user_id, role) do nothing;
  end if;

  raise notice '[seed] usuários locais prontos: admin@local.test / admin123 e pro@local.test / pro123';
exception
  when others then
    raise notice '[seed] falha ao criar usuários locais: %', sqlerrm;
end $$;

-- ── 3. Categorias de exemplo ────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.categories') is null then
    raise notice '[seed] categories ausente — pulando';
    return;
  end if;

  insert into public.categories (name, slug)
  values ('Eletricista', 'eletricista'),
         ('Encanador', 'encanador'),
         ('Diarista', 'diarista'),
         ('Pintor', 'pintor')
  on conflict (slug) do nothing;
exception
  when others then
    raise notice '[seed] categories: %', sqlerrm;
end $$;

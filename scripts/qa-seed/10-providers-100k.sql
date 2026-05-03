-- ============================================================================
-- QA Seed · 100.000 prestadores fictícios para teste de carga do RPC
-- nearby_providers e do índice GIST parcial idx_providers_geog_active.
-- ============================================================================
-- ⚠️ AMBIENTE DE QA APENAS. Nunca execute em produção.
--
-- Marcadores de idempotência:
--   profiles.email   LIKE 'seed-loadtest-%@qa.precisodeum.local'
--   profiles.user_ref LIKE 'seed:loadtest100k:%'
--   providers.user_ref LIKE 'seed:loadtest100k:%'
--
-- Distribuição geográfica (total ≈ 100.000):
--   São Paulo/SP        22.000   (densidade alta)
--   Curitiba/PR         18.000
--   Rio de Janeiro/RJ   15.000
--   + 24 capitais (~1.875/cada) = ~45.000
-- Jitter ±0.45° (~50 km) para simular região metropolitana.
--
-- Garantias para o índice parcial idx_providers_geog_active:
--   status='approved', onboarding_completed=true, deleted_at IS NULL
-- ============================================================================

\set ON_ERROR_STOP on
\timing on
SET search_path = public, extensions;

-- ────────────────────────────────────────────────────────────────────────────
-- 0) LIMPEZA IDEMPOTENTE — remove qualquer rodada anterior do seed
-- ────────────────────────────────────────────────────────────────────────────
\echo '== [0/5] Limpando seed anterior =='

BEGIN;

-- Desliga triggers para acelerar bulk delete
SET session_replication_role = replica;

DELETE FROM public.providers
 WHERE user_ref LIKE 'seed:loadtest100k:%';

DELETE FROM public.profiles
 WHERE user_ref LIKE 'seed:loadtest100k:%'
    OR email   LIKE 'seed-loadtest-%@qa.precisodeum.local';

DELETE FROM auth.users
 WHERE email LIKE 'seed-loadtest-%@qa.precisodeum.local';

SET session_replication_role = DEFAULT;

COMMIT;

-- ────────────────────────────────────────────────────────────────────────────
-- 1) DISTRIBUIÇÃO POR CAPITAL (tabela temporária)
-- ────────────────────────────────────────────────────────────────────────────
\echo '== [1/5] Montando distribuição geográfica =='

CREATE TEMP TABLE _seed_capitals (
  city text, state text, lat numeric, lon numeric, weight int
) ON COMMIT DROP;

INSERT INTO _seed_capitals VALUES
  ('São Paulo','SP',-23.5505,-46.6333,22000),
  ('Curitiba','PR',-25.4284,-49.2733,18000),
  ('Rio de Janeiro','RJ',-22.9068,-43.1729,15000),
  ('Belo Horizonte','MG',-19.9167,-43.9345,1875),
  ('Brasília','DF',-15.7942,-47.8822,1875),
  ('Salvador','BA',-12.9714,-38.5014,1875),
  ('Fortaleza','CE',-3.7172,-38.5433,1875),
  ('Manaus','AM',-3.1190,-60.0217,1875),
  ('Recife','PE',-8.0476,-34.8770,1875),
  ('Porto Alegre','RS',-30.0346,-51.2177,1875),
  ('Belém','PA',-1.4558,-48.5039,1875),
  ('Goiânia','GO',-16.6869,-49.2648,1875),
  ('Florianópolis','SC',-27.5969,-48.5495,1875),
  ('Vitória','ES',-20.3155,-40.3128,1875),
  ('Campo Grande','MS',-20.4697,-54.6201,1875),
  ('Cuiabá','MT',-15.6014,-56.0979,1875),
  ('Natal','RN',-5.7945,-35.2110,1875),
  ('Maceió','AL',-9.6498,-35.7089,1875),
  ('Teresina','PI',-5.0892,-42.8019,1875),
  ('João Pessoa','PB',-7.1195,-34.8450,1875),
  ('Aracaju','SE',-10.9472,-37.0731,1875),
  ('São Luís','MA',-2.5307,-44.3068,1875),
  ('Palmas','TO',-10.1689,-48.3317,1875),
  ('Porto Velho','RO',-8.7619,-63.9039,1875),
  ('Macapá','AP',0.0356,-51.0705,1875),
  ('Boa Vista','RR',2.8235,-60.6758,1875),
  ('Rio Branco','AC',-9.9747,-67.8243,1875);

-- Verifica total exato
SELECT 'Total esperado: ' || sum(weight) AS info FROM _seed_capitals;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) GERAÇÃO DE LINHAS (CTE única, sem loops)
-- ────────────────────────────────────────────────────────────────────────────
\echo '== [2/5] Gerando 100k linhas em memória =='

CREATE TEMP TABLE _seed_rows ON COMMIT DROP AS
WITH expanded AS (
  SELECT
    c.city, c.state, c.lat, c.lon,
    generate_series(1, c.weight) AS local_idx
  FROM _seed_capitals c
),
numbered AS (
  SELECT
    row_number() OVER () AS n,
    city, state, lat, lon
  FROM expanded
)
SELECT
  n,
  ('seed:loadtest100k:' || lpad(n::text,6,'0'))::text AS user_ref,
  ('seed-loadtest-' || lpad(n::text,6,'0') || '@qa.precisodeum.local')::text AS email,
  city, state,
  -- Jitter ±0.45° (~50 km) com seed determinístico (md5)
  (lat + ( (('x'||substr(md5('lat'||n::text),1,8))::bit(32)::int % 9000) / 10000.0 ))::numeric AS latitude,
  (lon + ( (('x'||substr(md5('lon'||n::text),1,8))::bit(32)::int % 9000) / 10000.0 ))::numeric AS longitude,
  -- Bairros realistas rotativos
  (ARRAY['Centro','Jardim América','Vila Nova','Boa Vista','Santa Felicidade',
         'Bairro Alto','Tatuquara','Pinheirinho','Portão','Bigorrilho'])
    [1 + (n % 10)] AS neighborhood,
  -- Telefones BR rotativos
  ('(' || lpad(((n % 90) + 10)::text,2,'0') || ') 9' ||
   lpad((n % 9999)::text,4,'0') || '-' ||
   lpad(((n*7) % 9999)::text,4,'0'))::text AS phone,
  -- Nome do negócio determinístico
  (ARRAY['Serviços','Soluções','Manutenção','Reparos','Express','Pro','Mestre','Técnico'])
    [1 + (n % 8)] || ' ' ||
  (ARRAY['Brasil','do Sul','do Norte','Express','24h','Já','Total','Premium'])
    [1 + ((n/8) % 8)] || ' #' || lpad(n::text,6,'0') AS business_name,
  -- Recency / completion factors realistas
  (now() - ((n % 60) || ' days')::interval)::timestamptz AS last_active_at,
  CASE WHEN n % 100 < 30 THEN now() + interval '3 days'
       WHEN n % 100 < 50 THEN now() + interval '1 day'
       ELSE NULL END AS completion_boost_until,
  -- Anos de experiência
  (1 + (n % 25))::int AS years_experience,
  -- Rating realista (3.5 a 5.0)
  round((3.5 + (n % 15) / 10.0)::numeric, 2) AS rating_avg,
  (n % 200)::int AS review_count
FROM numbered;

CREATE INDEX ON _seed_rows(n);
ANALYZE _seed_rows;

-- ────────────────────────────────────────────────────────────────────────────
-- 3) INSERT EM auth.users + profiles + providers
-- ────────────────────────────────────────────────────────────────────────────
\echo '== [3/5] Inserindo auth.users / profiles / providers =='

BEGIN;
SET LOCAL session_replication_role = replica;

-- 3.1 auth.users (UUID determinístico via md5 do user_ref)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user
)
SELECT
  ('00000000-0000-4000-8000-' || substr(md5(user_ref),1,12))::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated', email,
  crypt('seed-loadtest-pwd', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('seed','loadtest100k','user_ref',user_ref),
  false
FROM _seed_rows
ON CONFLICT (id) DO NOTHING;

-- 3.2 profiles
INSERT INTO public.profiles (
  id, full_name, email, phone, role, profile_type, status,
  user_ref, onboarding_completed, city, state, neighborhood,
  engagement_points, created_at, updated_at
)
SELECT
  ('00000000-0000-4000-8000-' || substr(md5(user_ref),1,12))::uuid,
  business_name,
  email,
  phone,
  'user',
  'provider',
  'active',
  user_ref,
  true,
  city, state, neighborhood,
  (n % 5000)::int,
  now() - ((n % 365) || ' days')::interval,
  now()
FROM _seed_rows
ON CONFLICT (id) DO NOTHING;

-- 3.3 providers (categoria sorteada entre as ativas existentes)
WITH cats AS (
  SELECT array_agg(id) AS ids
  FROM public.categories
  WHERE deleted_at IS NULL
)
INSERT INTO public.providers (
  id, user_id, business_name, description, city, state, neighborhood,
  phone, whatsapp, latitude, longitude,
  category_id, plan, status, onboarding_progress,
  years_experience, rating_avg, review_count,
  user_ref, slug, account_type,
  last_active_at, completion_boost_until,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  ('00000000-0000-4000-8000-' || substr(md5(r.user_ref),1,12))::uuid,
  r.business_name,
  'Prestador QA gerado por seed de carga. ' ||
    'Atende ' || r.city || '/' || r.state ||
    ' e região com ' || r.years_experience || ' anos de experiência. ' ||
    'Especialista em soluções rápidas e atendimento de qualidade. ' ||
    'Categoria de teste #' || r.n || '.',
  r.city, r.state, r.neighborhood,
  r.phone, r.phone,
  r.latitude, r.longitude,
  (cats.ids)[1 + (r.n % array_length(cats.ids,1))],
  'free',
  'approved',
  jsonb_build_object('completed', true, 'percent', 100),
  r.years_experience,
  r.rating_avg,
  r.review_count,
  r.user_ref,
  'seed-' || lpad(r.n::text,6,'0'),
  'individual',
  r.last_active_at,
  r.completion_boost_until,
  now() - ((r.n % 365) || ' days')::interval,
  now()
FROM _seed_rows r CROSS JOIN cats
ON CONFLICT (id) DO NOTHING;

-- Backfill geog (caso o trigger esteja desativado pelo session_replication_role)
UPDATE public.providers
   SET geog = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
 WHERE user_ref LIKE 'seed:loadtest100k:%'
   AND geog IS NULL;

SET LOCAL session_replication_role = DEFAULT;
COMMIT;

-- ────────────────────────────────────────────────────────────────────────────
-- 4) ANALYZE + sumário
-- ────────────────────────────────────────────────────────────────────────────
\echo '== [4/5] ANALYZE =='
ANALYZE public.providers;
ANALYZE public.profiles;

SELECT
  count(*) AS total_seed,
  count(*) FILTER (WHERE status='approved') AS approved,
  count(*) FILTER (WHERE geog IS NOT NULL) AS com_geog,
  count(DISTINCT category_id) AS categorias_distintas,
  count(DISTINCT city || '/' || state) AS cidades_distintas
FROM public.providers
WHERE user_ref LIKE 'seed:loadtest100k:%';

-- ────────────────────────────────────────────────────────────────────────────
-- 5) VALIDAÇÃO PÓS-CARGA — EXPLAIN do RPC nearby_providers
-- ────────────────────────────────────────────────────────────────────────────
\echo '== [5/5] EXPLAIN (ANALYZE, BUFFERS) do RPC nearby_providers =='

\echo '----- Curitiba/PR · raio 10 km -----'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM public.nearby_providers(
  _lat := -25.4284, _lng := -49.2733,
  _radius_km := 10, _limit := 50
);

\echo '----- São Paulo/SP · raio 5 km -----'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM public.nearby_providers(
  _lat := -23.5505, _lng := -46.6333,
  _radius_km := 5, _limit := 50
);

\echo '----- Rio de Janeiro/RJ · raio 15 km -----'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM public.nearby_providers(
  _lat := -22.9068, _lng := -43.1729,
  _radius_km := 15, _limit := 100
);

\echo '----- Manaus/AM · raio 25 km (cauda longa) -----'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM public.nearby_providers(
  _lat := -3.1190, _lng := -60.0217,
  _radius_km := 25, _limit := 50
);

-- Confirma uso do índice parcial
\echo '----- Uso do índice GIST parcial -----'
SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE relname = 'providers'
  AND indexrelname IN ('idx_providers_geog_active','idx_providers_geog')
ORDER BY indexrelname;

\echo '== SEED 100k CONCLUÍDO =='

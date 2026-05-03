/**
 * k6 Load Test — PrecisodeumProfissional.com.br
 *
 * Cenários:
 *   1) Busca geográfica concorrente via RPC `nearby_providers` (PostGIS+ranking híbrido).
 *   2) Auto-save de rascunhos do wizard via `onboarding_v2_drafts` (UPSERT concorrente).
 *
 * Thresholds (SLO):
 *   - p95 < 500ms para o RPC de busca
 *   - p95 < 800ms para upsert de drafts
 *   - error rate < 1%
 *
 * Uso local (não roda em CI):
 *   k6 run scripts/load-test.js \
 *     -e SUPABASE_URL=https://qaftogrqeyymewoofexc.supabase.co \
 *     -e SUPABASE_ANON_KEY=<anon_key>
 *
 * Observação: usa apenas a chave anônima e respeita RLS. Não autentica usuários.
 * Para o cenário de drafts é necessário um JWT real (passar -e SUPABASE_JWT=<token>);
 * caso contrário, esse cenário é pulado automaticamente.
 *
 * Documentação: https://k6.io/docs
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://qaftogrqeyymewoofexc.supabase.co';
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';
const SUPABASE_JWT = __ENV.SUPABASE_JWT || ''; // opcional: habilita cenário de drafts

if (!SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_ANON_KEY env var is required');
}

// Coordenadas representativas (capitais brasileiras) para simular tráfego real distribuído.
const GEO_POINTS = [
  { city: 'São Paulo', lat: -23.5505, lng: -46.6333 },
  { city: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
  { city: 'Belo Horizonte', lat: -19.9167, lng: -43.9345 },
  { city: 'Curitiba', lat: -25.4284, lng: -49.2733 },
  { city: 'Porto Alegre', lat: -30.0346, lng: -51.2177 },
  { city: 'Salvador', lat: -12.9714, lng: -38.5014 },
  { city: 'Brasília', lat: -15.7975, lng: -47.8919 },
  { city: 'Fortaleza', lat: -3.7172, lng: -38.5433 },
];

// Métricas customizadas
const searchLatency = new Trend('search_rpc_latency', true);
const draftLatency = new Trend('draft_upsert_latency', true);
const searchErrors = new Rate('search_errors');
const draftErrors = new Rate('draft_errors');

export const options = {
  scenarios: {
    // 100 VUs concorrentes em buscas geográficas — perfil principal de tráfego.
    geographic_search: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // ramp-up
        { duration: '2m', target: 100 },   // sustained 100 VUs
        { duration: '30s', target: 0 },    // ramp-down
      ],
      exec: 'searchScenario',
      gracefulRampDown: '15s',
    },
    // Cenário de escrita: só ativa se SUPABASE_JWT for fornecido.
    ...(SUPABASE_JWT
      ? {
          draft_upsert: {
            executor: 'constant-vus',
            vus: 20,
            duration: '2m',
            exec: 'draftScenario',
            startTime: '30s',
          },
        }
      : {}),
  },
  thresholds: {
    'search_rpc_latency': ['p(95)<500'],     // SLO: p95 < 500ms
    'draft_upsert_latency': ['p(95)<800'],
    'search_errors': ['rate<0.01'],          // < 1% de erros
    'draft_errors': ['rate<0.01'],
    'http_req_failed': ['rate<0.02'],
  },
};

const baseHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

export function searchScenario() {
  const point = GEO_POINTS[Math.floor(Math.random() * GEO_POINTS.length)];

  const payload = JSON.stringify({
    _lat: point.lat,
    _lng: point.lng,
    _radius_km: 50,
    _limit: 20,
    _offset: 0,
  });

  const res = http.post(`${SUPABASE_URL}/rest/v1/rpc/nearby_providers`, payload, {
    headers: baseHeaders,
    tags: { rpc: 'nearby_providers', city: point.city },
  });

  searchLatency.add(res.timings.duration);
  searchErrors.add(res.status !== 200);

  check(res, {
    'search 200': (r) => r.status === 200,
    'search has body': (r) => !!r.body && r.body.length > 0,
    'search p95 budget': (r) => r.timings.duration < 500,
  });

  sleep(Math.random() * 2 + 0.5); // 0.5–2.5s entre buscas
}

export function draftScenario() {
  const authHeaders = {
    ...baseHeaders,
    Authorization: `Bearer ${SUPABASE_JWT}`,
  };

  const payload = JSON.stringify({
    phase: 'phase2_service',
    profile: { kind: 'autonomous', name: `LoadTest VU${__VU}` },
    services: [{ name: `Serviço ${__ITER}`, category_id: null }],
    updated_at: new Date().toISOString(),
  });

  const res = http.post(
    `${SUPABASE_URL}/rest/v1/onboarding_v2_drafts?on_conflict=user_id`,
    payload,
    {
      headers: { ...authHeaders, Prefer: 'resolution=merge-duplicates' },
      tags: { table: 'onboarding_v2_drafts' },
    },
  );

  draftLatency.add(res.timings.duration);
  draftErrors.add(res.status >= 400);

  check(res, {
    'draft upsert 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  sleep(Math.random() * 3 + 1); // simula auto-save ~1-4s
}

export function handleSummary(data) {
  const search = data.metrics.search_rpc_latency || {};
  const errs = data.metrics.search_errors || {};

  // eslint-disable-next-line no-console
  console.log(`
====== Load Test Summary ======
Search RPC nearby_providers:
  p50:  ${(search.values?.med || 0).toFixed(0)}ms
  p95:  ${(search.values?.['p(95)'] || 0).toFixed(0)}ms  (SLO: <500ms)
  p99:  ${(search.values?.['p(99)'] || 0).toFixed(0)}ms
  err%: ${((errs.values?.rate || 0) * 100).toFixed(2)}%
================================
`);

  return {
    'stdout': JSON.stringify(data.metrics, null, 2),
  };
}

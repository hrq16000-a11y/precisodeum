#!/usr/bin/env node
/**
 * Fase A · item 4 — Smoke test de GRANT EXECUTE para o papel anônimo.
 *
 * Chama cada RPC crítica de tracking usando somente a chave publishable
 * (papel `anon`) e falha se qualquer uma responder 42501 / permission denied.
 *
 * Uso:
 *   node scripts/verify-anon-tracking-grants.mjs
 *
 * Variáveis: VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.
 */

const URL_BASE = process.env.VITE_SUPABASE_URL;
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!URL_BASE || !ANON_KEY) {
  console.error(
    'Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_PUBLISHABLE_KEY no ambiente.',
  );
  process.exit(1);
}

const stamp = Date.now();

/** RPCs que DEVEM ser chamáveis por visitantes não autenticados. */
const CASES = [
  {
    name: 'log_search_intent',
    body: {
      _category_slug: 'ci-smoke',
      _category_name: 'CI Smoke',
      _city: 'ci-city',
      _state: 'PR',
      _visitor_id: `ci-${stamp}`,
      _dedupe_key: `ci-search-${stamp}`,
    },
  },
  {
    name: 'record_public_funnel_event',
    body: {
      _action: 'city_view',
      _city: 'ci-city',
      _resource_id: 'ci-city',
      _pathname: '/ci-smoke',
      _source: 'ci',
      _dedupe_key: `ci-funnel-${stamp}`,
    },
  },
  {
    name: 'record_tracking_rpc_health',
    body: {
      _rpc_name: 'log_search_intent',
      _outcome: 'success',
      _latency_ms: 1,
      _pathname: '/ci-smoke',
    },
  },
  // track_sponsor_metric exige um sponsor_id real; validamos apenas que o
  // papel anon tem permissão de EXECUTE (erro de FK é aceitável, 42501 não).
  {
    name: 'track_sponsor_metric',
    body: {
      _sponsor_id: '00000000-0000-0000-0000-000000000000',
      _slot_slug: 'ci-smoke',
      _event_type: 'impression',
      _page_path: '/ci-smoke',
      _dedupe_key: `ci-sponsor-${stamp}`,
    },
    tolerateCodes: ['23503'], // violação de FK com sponsor inexistente
  },
];

async function callRpc(name, body) {
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  return { status: res.status, payload };
}

let failed = 0;

for (const testCase of CASES) {
  const { status, payload } = await callRpc(testCase.name, testCase.body);
  const code = payload && typeof payload === 'object' ? payload.code : undefined;
  const message =
    payload && typeof payload === 'object' ? String(payload.message ?? '') : '';

  const isPermissionDenied =
    code === '42501' || /permission denied/i.test(message) || status === 403;

  if (isPermissionDenied) {
    console.error(`FAIL ${testCase.name}: permission denied (status ${status}) ${message}`);
    failed += 1;
    continue;
  }

  const tolerated = (testCase.tolerateCodes || []).includes(code);
  if (status >= 400 && !tolerated) {
    console.error(
      `FAIL ${testCase.name}: status ${status} code=${code ?? '-'} ${message}`,
    );
    failed += 1;
    continue;
  }

  console.log(`OK   ${testCase.name} (status ${status}${tolerated ? `, código tolerado ${code}` : ''})`);
}

if (failed > 0) {
  console.error(`\n${failed} RPC(s) de tracking com regressão de permissão.`);
  process.exit(1);
}

console.log('\nTodas as RPCs de tracking continuam chamáveis como anon.');

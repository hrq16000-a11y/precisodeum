#!/usr/bin/env node
/**
 * Dispara a submissão do sitemap index particionado ao Google Search Console.
 *
 * Uso (CI pós-build/deploy):
 *   SUPABASE_FUNCTIONS_URL=https://<ref>.supabase.co/functions/v1 \
 *   CRON_SECRET=*** \
 *   SITE_BASE=https://www.precisodeum.com.br \
 *   node scripts/gsc-submit-sitemaps.mjs
 *
 * Flags:
 *   --dry-run    apenas lista o que seria submetido
 *   --soft-fail  loga o erro e sai com código 0 (não quebra o pipeline)
 */

const FUNCTIONS_URL = (process.env.SUPABASE_FUNCTIONS_URL || '').replace(/\/+$/, '');
const CRON_SECRET = process.env.CRON_SECRET || '';
const SITE_BASE = process.env.SITE_BASE || 'https://www.precisodeum.com.br';
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const dryRun = process.argv.includes('--dry-run');
const softFail = process.argv.includes('--soft-fail');

function bail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(softFail ? 0 : 1);
}

if (!FUNCTIONS_URL) bail('SUPABASE_FUNCTIONS_URL não definido.');
if (!CRON_SECRET) bail('CRON_SECRET não definido.');

const endpoint = `${FUNCTIONS_URL}/gsc-submit-sitemaps`;

try {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': CRON_SECRET,
      ...(ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {}),
    },
    body: JSON.stringify({ site: `${SITE_BASE.replace(/\/+$/, '')}/`, dryRun }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok && res.status !== 207) {
    console.error(JSON.stringify(data, null, 2));
    bail(`Submissão falhou [HTTP ${res.status}]`);
  }

  if (dryRun) {
    console.log(`↷ Dry-run — propriedade: ${data.property}`);
    (data.sitemaps || []).forEach((s) => console.log(`   • ${s}`));
    process.exit(0);
  }

  console.log(`Propriedade GSC: ${data.property}`);
  console.log(`Submetidos: ${data.submitted} | OK: ${data.succeeded} | Falhas: ${data.failed}`);
  for (const r of data.results || []) {
    console.log(`  ${r.ok ? '✓' : '✖'} [${r.status}] ${r.sitemap}${r.error ? ` — ${r.error}` : ''}`);
  }

  if (data.failed > 0) bail(`${data.failed} sitemap(s) não foram aceitos pelo Google.`);
  console.log('✓ Sitemap particionado submetido ao Google Search Console.');
} catch (err) {
  bail(`Erro de rede ao chamar ${endpoint}: ${err}`);
}

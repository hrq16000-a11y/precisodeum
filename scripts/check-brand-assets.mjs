#!/usr/bin/env node
/**
 * CI · Brand assets reachability check
 *
 * Verifica que o logo, suas variantes (webp/png 380w/710w) e as imagens
 * og/social estão acessíveis. Em modo "local" (default) confere a presença
 * dos arquivos em /public. Quando BRAND_CHECK_BASE_URL é definido, dispara
 * HEAD requests na URL pública e falha o build se algum asset não retornar
 * 2xx ou tiver Content-Length ≤ 0.
 *
 * Uso:
 *   node scripts/check-brand-assets.mjs
 *   BRAND_CHECK_BASE_URL=https://precisodeum.com.br node scripts/check-brand-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BRAND_CHECK_BASE_URL?.replace(/\/$/, '') || '';
const ROOT = process.cwd();

const ASSETS = [
  '/lovable-uploads/8a22c45f-f2c2-4ac8-a925-92aecd2b313b.png',
  '/lovable-uploads/logo-brand-380.webp',
  '/lovable-uploads/logo-brand-710.webp',
  '/lovable-uploads/logo-brand-380.png',
  '/lovable-uploads/logo-brand-710.png',
  '/social-image.png',
  '/og-image.png',
  '/favicon.ico',
];

const failures = [];

const checkLocal = (rel) => {
  const abs = path.join(ROOT, 'public', rel.replace(/^\//, ''));
  if (!fs.existsSync(abs)) return `missing on disk: public${rel}`;
  const size = fs.statSync(abs).size;
  if (size <= 100) return `too small (${size}B): public${rel}`;
  return null;
};

const checkRemote = async (rel) => {
  const url = `${BASE}${rel}`;
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    // alguns CDNs respondem 405 em HEAD — fallback para GET
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { method: 'GET', redirect: 'follow' });
    }
    if (!res.ok) return `HTTP ${res.status} for ${url}`;
    const len = Number(res.headers.get('content-length') || 0);
    if (len > 0 && len < 100) return `payload too small (${len}B): ${url}`;
    const type = res.headers.get('content-type') || '';
    if (type && !/(image|octet-stream)/i.test(type)) {
      return `unexpected content-type "${type}" for ${url}`;
    }
    return null;
  } catch (err) {
    return `network error for ${url}: ${err?.message || err}`;
  }
};

const run = async () => {
  console.log(`[brand-assets] checking ${ASSETS.length} assets ${BASE ? `against ${BASE}` : '(local mode)'}…`);
  for (const rel of ASSETS) {
    const err = BASE ? await checkRemote(rel) : checkLocal(rel);
    if (err) {
      failures.push(err);
      console.error(`  ✗ ${rel} — ${err}`);
    } else {
      console.log(`  ✓ ${rel}`);
    }
  }
  if (failures.length) {
    console.error(`\n[brand-assets] FAIL · ${failures.length} asset(s) inacessível(eis).`);
    process.exit(1);
  }
  console.log('\n[brand-assets] OK · todos os assets acessíveis.');
};

run();

#!/usr/bin/env node
/**
 * sync-sw-version.mjs — sincroniza `CACHE_VERSION` em public/sw.js com
 * `APP_VERSION` de src/lib/appVersion.ts.
 *
 * Roda antes do build (prebuild) para evitar que o SW sirva HTML antigo
 * após um deploy que bumpou APP_VERSION mas esqueceu o sw.js.
 *
 * Idempotente, falha-soft (warn e exit 0) para não bloquear o build.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const APP_VERSION_FILE = resolve(root, 'src/lib/appVersion.ts');
const SW_FILE = resolve(root, 'public/sw.js');

try {
  const appSrc = readFileSync(APP_VERSION_FILE, 'utf8');
  const m = appSrc.match(/export const APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!m) {
    console.warn('[sync-sw-version] APP_VERSION não encontrado, pulando.');
    process.exit(0);
  }
  const appVersion = m[1];
  const target = `v${appVersion}`;

  const swSrc = readFileSync(SW_FILE, 'utf8');
  const swMatch = swSrc.match(/const CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!swMatch) {
    console.warn('[sync-sw-version] CACHE_VERSION não encontrado em sw.js, pulando.');
    process.exit(0);
  }
  if (swMatch[1] === target) {
    console.log(`[sync-sw-version] já sincronizado em ${target}`);
    process.exit(0);
  }

  const updated = swSrc.replace(
    /const CACHE_VERSION\s*=\s*['"][^'"]+['"]/,
    `const CACHE_VERSION = '${target}'`,
  );
  writeFileSync(SW_FILE, updated, 'utf8');
  console.log(`[sync-sw-version] CACHE_VERSION ${swMatch[1]} → ${target}`);
} catch (err) {
  console.warn('[sync-sw-version] erro (não-fatal):', err?.message || err);
  process.exit(0);
}

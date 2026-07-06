#!/usr/bin/env node
/**
 * RPC Grants Diff — static analysis of supabase/migrations/*.sql.
 *
 * Goals:
 *  1. Enumerate every `GRANT EXECUTE ON FUNCTION ... TO <role>` and every
 *     `REVOKE EXECUTE ON FUNCTION ... FROM <role>` across migrations.
 *  2. Build the CURRENT effective grants matrix (in-order replay of statements).
 *  3. Compare against a checked-in baseline (`scripts/rpc-grants-baseline.json`).
 *  4. FAIL when a NEW function becomes callable by `anon` or `PUBLIC` and is not
 *     explicitly declared safe in `scripts/rpc-grants-allowlist.json`.
 *  5. Emit a machine-readable JSON report to `.rpc-grants-report.json` for CI
 *     artifacts + a human-readable summary to stdout.
 *
 * This intentionally does NOT connect to the database — it works purely from
 * the migration history, so it runs in every PR without secrets.
 *
 * Update the baseline (after review) with:
 *   node scripts/audit-rpc-grants.mjs --update-baseline
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const MIG_DIR = join(ROOT, 'supabase/migrations');
const BASELINE = join(ROOT, 'scripts/rpc-grants-baseline.json');
const ALLOWLIST = join(ROOT, 'scripts/rpc-grants-allowlist.json');
const REPORT = join(ROOT, '.rpc-grants-report.json');

const UPDATE = process.argv.includes('--update-baseline');

// Match: GRANT EXECUTE ON FUNCTION public.foo(uuid, text) TO anon, authenticated;
// Or:    GRANT EXECUTE ON FUNCTION public.foo TO PUBLIC;
// Or:    REVOKE EXECUTE ON FUNCTION public.foo(...) FROM anon;
const GRANT_RE =
  /(GRANT|REVOKE)\s+EXECUTE\s+ON\s+FUNCTION\s+([a-z_][\w.]*)\s*(\(([^)]*)\))?\s+(TO|FROM)\s+([^;]+);/gi;

const ROLE_NORM = (r) => r.trim().replace(/"/g, '').toLowerCase();
const KNOWN_ROLES = new Set(['anon', 'authenticated', 'service_role', 'postgres', 'public']);

function listMigrations() {
  return readdirSync(MIG_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function parseAll() {
  // key: "schema.name(args_normalized)" — args normalized by removing modes/names
  const state = new Map();
  const events = [];
  for (const file of listMigrations()) {
    const sql = readFileSync(join(MIG_DIR, file), 'utf8');
    let m;
    GRANT_RE.lastIndex = 0;
    while ((m = GRANT_RE.exec(sql))) {
      const [, kind, name, , argsRaw, dir, rolesRaw] = m;
      const args = normalizeArgs(argsRaw ?? '');
      const key = `${name}(${args})`;
      const roles = rolesRaw
        .split(',')
        .map(ROLE_NORM)
        .filter((r) => r && (KNOWN_ROLES.has(r) || true));
      const cur = state.get(key) ?? new Set();
      for (const role of roles) {
        if (kind.toUpperCase() === 'GRANT' && dir.toUpperCase() === 'TO') cur.add(role);
        else if (kind.toUpperCase() === 'REVOKE' && dir.toUpperCase() === 'FROM') cur.delete(role);
      }
      state.set(key, cur);
      events.push({ file, key, kind: kind.toUpperCase(), roles });
    }
  }
  const grants = {};
  for (const [k, v] of state) grants[k] = [...v].sort();
  return { grants, events };
}

function normalizeArgs(s) {
  // strip parameter names/modes, keep type list; collapse whitespace
  return s
    .split(',')
    .map((p) => {
      const t = p.trim();
      if (!t) return '';
      // drop leading mode + name if present, keep last token(s) that form a type
      const parts = t.split(/\s+/);
      // heuristic: take the type portion after any IN/OUT/INOUT + name
      const filtered = parts.filter((x) => !/^(in|out|inout|variadic)$/i.test(x));
      // if 2+ tokens, drop the first (name); else keep as-is
      const typ = filtered.length >= 2 ? filtered.slice(1).join(' ') : filtered.join(' ');
      return typ.toLowerCase();
    })
    .filter(Boolean)
    .join(',');
}

function loadJson(p, fallback) {
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback;
}

const { grants, events } = parseAll();
const baseline = loadJson(BASELINE, { grants: {} });
const allowlist = loadJson(ALLOWLIST, { anon_callable: [], public_callable: [] });

const risky = [];
for (const [fn, roles] of Object.entries(grants)) {
  const exposed = roles.some((r) => r === 'anon' || r === 'public');
  if (!exposed) continue;
  const allowed =
    allowlist.anon_callable.includes(fn) || allowlist.public_callable.includes(fn);
  const prevRoles = baseline.grants[fn] ?? [];
  const wasExposed = prevRoles.some((r) => r === 'anon' || r === 'public');
  if (!allowed && !wasExposed) {
    risky.push({ fn, roles, reason: 'newly_exposed_to_anon_or_public' });
  } else if (!allowed && wasExposed) {
    risky.push({ fn, roles, reason: 'still_exposed_not_in_allowlist' });
  }
}

const removed = [];
for (const fn of Object.keys(baseline.grants)) {
  if (!(fn in grants)) removed.push(fn);
}

const report = {
  generated_at: new Date().toISOString(),
  totals: {
    functions_with_grants: Object.keys(grants).length,
    events: events.length,
    risky: risky.length,
    removed_from_baseline: removed.length,
  },
  risky,
  removed,
  grants,
};
writeFileSync(REPORT, JSON.stringify(report, null, 2));

if (UPDATE) {
  writeFileSync(BASELINE, JSON.stringify({ grants }, null, 2) + '\n');
  console.log(`[audit-rpc-grants] Baseline updated: ${BASELINE}`);
  process.exit(0);
}

console.log(`[audit-rpc-grants] Functions with grants: ${Object.keys(grants).length}`);
console.log(`[audit-rpc-grants] Risky (anon/public not allowlisted): ${risky.length}`);
if (risky.length) {
  console.error('\nNew or unlisted anon/public-callable functions:');
  for (const r of risky) console.error(`  - ${r.fn} → [${r.roles.join(', ')}]  (${r.reason})`);
  console.error(
    '\nIf intentional: add the function to scripts/rpc-grants-allowlist.json and run',
  );
  console.error('  node scripts/audit-rpc-grants.mjs --update-baseline');
  process.exit(1);
}
console.log('[audit-rpc-grants] OK — no new anon/public exposure.');

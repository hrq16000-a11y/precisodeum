#!/usr/bin/env node
/**
 * Forbids direct reads of `tax_id` on `providers` / `profiles` from public-facing
 * pages and components. Sensitive document data must always go through the secure
 * RPCs `get_profile_tax_id` / `set_profile_tax_id` (SECURITY DEFINER, owner+admin).
 *
 * Whitelist:
 *  - The onboarding wizard (owner-side persistence, uses the RPC).
 *  - Generated supabase types.
 *  - Tests.
 *
 * Run via: node scripts/lint-tax-id-access.mjs
 * Exits with code 1 on violation.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN_DIR = join(ROOT, 'src');

const ALLOWLIST = [
  'src/integrations/supabase/types.ts',
  'src/components/onboarding/SmartOnboardingWizard.tsx',
  'src/components/onboarding/CpfCnpjInput.tsx',
];

// any direct .from('profiles' | 'providers') ... select(...) referencing tax_id
const DIRECT_TABLE_RE = /\.from\(\s*['"`](profiles|providers)['"`]\s*\)[\s\S]{0,400}?\.select\(\s*['"`][^'"`]*tax_id/g;
// raw string occurrence of "tax_id" outside the allowlist (catch-all guardrail)
const RAW_RE = /\btax_id\b/g;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const violations = [];
for (const file of walk(SCAN_DIR)) {
  const rel = relative(ROOT, file);
  if (ALLOWLIST.some((a) => rel === a)) continue;
  const src = readFileSync(file, 'utf8');
  if (!RAW_RE.test(src)) continue;
  // Reset lastIndex (RAW_RE has /g)
  RAW_RE.lastIndex = 0;
  if (DIRECT_TABLE_RE.test(src)) {
    violations.push({ file: rel, kind: 'direct_table_select_with_tax_id' });
    DIRECT_TABLE_RE.lastIndex = 0;
    continue;
  }
  // Also forbid any other reference to tax_id outside the allowlist — the only
  // legitimate consumers are the wizard (owner) and the secure RPC call sites.
  // RPC call sites use the literal string 'get_profile_tax_id' / 'set_profile_tax_id',
  // which both match \btax_id\b. We require those files to be allowlisted explicitly.
  violations.push({ file: rel, kind: 'tax_id_reference_outside_allowlist' });
}

if (violations.length) {
  console.error('\n[lint-tax-id-access] Forbidden references to tax_id outside the secure RPC path:');
  for (const v of violations) console.error(`  - ${v.file} (${v.kind})`);
  console.error('\nUse supabase.rpc("get_profile_tax_id" | "set_profile_tax_id"). Add the file to ALLOWLIST only if it is the owner-side wizard or generated code.');
  process.exit(1);
}

console.log('[lint-tax-id-access] OK — no forbidden tax_id references found.');

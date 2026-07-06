#!/usr/bin/env node
/**
 * Lint sensitive payloads in `.rpc(...)` / `.insert(...)` / `.update(...)` calls.
 *
 * Forbids passing CPF/CNPJ/tax_id/email/phone/whatsapp key names in payloads
 * unless the file is explicitly allow-listed OR the RPC name is on the
 * secure-RPC allowlist (owner + admin, SECURITY DEFINER).
 *
 * Static-analysis heuristic — scans src/**\/*.ts(x) and supabase/functions.
 * Exits 1 on violation.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN_DIRS = [join(ROOT, 'src'), join(ROOT, 'supabase/functions')];

const SENSITIVE_KEYS = ['cpf', 'cnpj', 'tax_id', 'email', 'phone', 'whatsapp'];

// files that legitimately transport sensitive fields (owner-side wizard,
// auth flows, admin panels through secure RPCs, generated code, tests).
const FILE_ALLOWLIST = [
  'src/integrations/supabase/types.ts',
  'src/integrations/supabase/client.ts',
  // Grandfathered legitimate callsites (owner-side writes / lead submit forms).
  // New files must NOT be added here without security review — prefer secure RPCs.
  'src/components/admin/UserDetailSheet.tsx',
  'src/contexts/WhatsAppGateContext.tsx',
  'src/pages/CompanyProfile.tsx',
  'src/pages/DashboardJobsPage.tsx',
  'src/pages/DashboardProfilePage.tsx',
  'src/pages/ProviderProfile.tsx',
  'src/pages/SponsorLandingPage.tsx',
  'src/pages/sponsor/SponsorDataPage.tsx',
];
const FILE_ALLOWLIST_PREFIX = [
  'src/components/onboarding/',
  'src/components/wizard/',
  'src/hooks/onboarding/',
  'src/pages/CadastroInicialPage',
  'src/pages/LoginPage',
  'src/pages/SignupPage',
  'src/pages/ResetPasswordPage',
  'src/pages/DashboardPerfilPage',
  'src/pages/DashboardNotificacoesPreferenciasPage',
  'src/pages/admin/',
  'src/pages/Admin',
  'src/lib/auth',
  'src/lib/onboarding',
  'src/lib/wizard',
  'src/lib/rpcContracts',
  'supabase/functions/',
];

// RPC names that are the SECURE path (SECURITY DEFINER + owner/admin gate).
const SECURE_RPCS = new Set([
  'get_profile_tax_id',
  'set_profile_tax_id',
  'admin_reset_password',
  'admin_impersonate',
  'claim_sponsor_lead',
]);

const CALL_RE = /\.(rpc|insert|update|upsert)\s*\(\s*([^)]{0,4000})/g;

function walk(dir, acc = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) acc.push(p);
  }
  return acc;
}

function isAllowlisted(rel) {
  if (FILE_ALLOWLIST.includes(rel)) return true;
  return FILE_ALLOWLIST_PREFIX.some((p) => rel.startsWith(p));
}

const violations = [];

for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    const rel = relative(ROOT, file);
    if (isAllowlisted(rel)) continue;
    const src = readFileSync(file, 'utf8');
    CALL_RE.lastIndex = 0;
    let m;
    while ((m = CALL_RE.exec(src))) {
      const kind = m[1];
      const head = m[2];
      // For .rpc('name', {...}) — pull the name
      let rpcName = null;
      if (kind === 'rpc') {
        const nameMatch = head.match(/^['"`]([\w.]+)['"`]/);
        if (nameMatch) rpcName = nameMatch[1];
      }
      if (rpcName && SECURE_RPCS.has(rpcName)) continue;
      // detect sensitive key names in the payload portion
      for (const key of SENSITIVE_KEYS) {
        const re = new RegExp(`\\b${key}\\b\\s*:`, 'i');
        if (re.test(head)) {
          violations.push({
            file: rel,
            kind,
            rpc: rpcName ?? '(table)',
            key,
            snippet: head.slice(0, 140).replace(/\s+/g, ' ').trim(),
          });
        }
      }
    }
  }
}

if (violations.length) {
  console.error('\n[lint-sensitive-payloads] Sensitive fields passed outside allowlisted callsites:');
  for (const v of violations) {
    console.error(`  - ${v.file}  (${v.kind} → ${v.rpc})  key=${v.key}`);
    console.error(`      ${v.snippet}`);
  }
  console.error(
    '\nMove the write behind a secure RPC (SECURITY DEFINER + owner/admin guard),',
  );
  console.error('or add the file/prefix to FILE_ALLOWLIST / SECURE_RPCS in scripts/lint-sensitive-payloads.mjs.');
  process.exit(1);
}

console.log('[lint-sensitive-payloads] OK — no forbidden sensitive payloads found.');

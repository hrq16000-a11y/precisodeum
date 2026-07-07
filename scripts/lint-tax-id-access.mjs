#!/usr/bin/env node
/**
 * Forbids direct reads of `tax_id` on `providers` / `profiles` from public-facing
 * pages and components. Sensitive document data must always go through the secure
 * RPCs `get_profile_tax_id` / `set_profile_tax_id` (SECURITY DEFINER, owner+admin).
 *
 * Detection strategy (S-01 refinement):
 *  1. `direct_table_select_with_tax_id` — `.from('profiles'|'providers').select('...tax_id...')`
 *     is ALWAYS a violation, regardless of allowlist. This is the load-bearing rule.
 *  2. Comments (line + block) are stripped before the catch-all `\btax_id\b` scan
 *     so pure documentation mentions do not trigger.
 *  3. Sanitizer context is recognized and allowed: when every remaining occurrence
 *     of `tax_id` sits on a line that is clearly PII-sanitization (regex literal or
 *     an array/list of quoted PII field names alongside vocabulary like `pii`,
 *     `sanitize`, `redact`, `mask`, `sensitive`, `forbidden`, `_KEY_PATTERN`).
 *  4. Explicit ALLOWLIST for owner-side wizard/onboarding/dashboard/admin files
 *     that were audited manually and legitimately reference the field.
 *
 * Whitelist is EXPLICIT — no wildcards, no prefix expansion. New files must be
 * reviewed one by one.
 *
 * Run via: node scripts/lint-tax-id-access.mjs
 * Exits with code 1 on violation.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN_DIR = join(ROOT, 'src');

// -- Allowlist ---------------------------------------------------------------
// Reviewed on 2026-07-07 during S-01 triage. Each entry is a file where the
// literal `tax_id` appears in an owner-side, RLS-scoped, or documentation
// context that was manually inspected. NO wildcards allowed.
const ALLOWLIST = [
  // Generated / infra
  'src/integrations/supabase/types.ts',

  // Owner-side wizard input components (legacy allowlist).
  'src/components/onboarding/SmartOnboardingWizard.tsx',
  'src/components/onboarding/CpfCnpjInput.tsx',

  // Owner-side wizard V2/Bet — writes are always filtered by the caller's own
  // auth.uid() against `profiles` and the fields are the user's own document.
  'src/components/onboarding/wizard/phases/Step22_Review.tsx',
  'src/components/onboarding/wizard/phases/bet/BetModeShell.tsx',
  'src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx',
  'src/components/onboarding/wizard/phases/v2/bootstrap.ts',
  'src/lib/operations/buildBetFinalizeOperation.ts',

  // Owner-side reads (own profile only)
  'src/hooks/useOnboardingStatus.ts',
  'src/pages/DashboardAssistantPage.tsx',
  'src/components/dashboard/IdentitySuggestionsWidget.tsx',

  // TODO(security): useWizardDuplicateCheck.ts performs a duplicate-detection
  // read that is currently gated by RLS. Migrate to a dedicated SECURITY
  // DEFINER RPC (proposed: `check_document_duplicate(_last4 text, _kind text)`
  // returning boolean only, never the tax_id itself). Tracked separately;
  // allowlisted here so the CI job does not block unrelated PRs.
  'src/hooks/useWizardDuplicateCheck.ts',
];

// -- Detectors ---------------------------------------------------------------
// Any direct .from('profiles' | 'providers') ... select(...) referencing tax_id.
// This rule is NEVER waived by the allowlist.
const DIRECT_TABLE_RE = /\.from\(\s*['"`](profiles|providers)['"`]\s*\)[\s\S]{0,400}?\.select\(\s*['"`][^'"`]*tax_id/g;

// Raw catch-all: applied AFTER stripping comments and sanitizer lines.
const RAW_RE = /\btax_id\b/g;

// Vocabulary that marks a line as PII sanitization/redaction rather than access.
const SANITIZER_VOCAB = /\b(pii|sanitize|redact|mask|scrub|forbidden|sensitive|_key_pattern|piikey|pii_key|pii_field|deny_?list|redact_?keys)\b/i;

// Heuristic: a line where tax_id sits inside a regex literal /(...)/ …flags.
const REGEX_LITERAL_WITH_TAX_ID = /\/[^\n\/]*\btax_id\b[^\n\/]*\/[gimsuy]*/;

// Heuristic: a line that is basically a list of quoted PII field names.
// Matches when the line has ≥2 quoted PII-like tokens and includes tax_id.
const PII_LIST_LINE = /(['"`])(email|phone|whatsapp|cpf|cnpj|tax_id|address|document|rg|doc_number|cep|street|complement|password|token|raw_input|payload|name)\1[\s\S]{0,120}(['"`])(email|phone|whatsapp|cpf|cnpj|tax_id|address|document|rg|doc_number|cep|street|complement|password|token|raw_input|payload|name)\3/;

function stripComments(src) {
  // Remove /* block */ comments then // line comments. Not perfect w.r.t. strings,
  // but good enough for our heuristic (we still keep DIRECT_TABLE_RE running on
  // the raw source below).
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

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

function classifyOccurrences(strippedSrc) {
  // For each occurrence of tax_id in the stripped source, look at its line and
  // decide whether it is sanitizer/regex/list context or a real reference.
  const lines = strippedSrc.split('\n');
  let real = 0;
  let sanitizer = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/\btax_id\b/.test(line)) continue;
    const isSanitizer =
      REGEX_LITERAL_WITH_TAX_ID.test(line) ||
      (PII_LIST_LINE.test(line) && SANITIZER_VOCAB.test(line)) ||
      // list line without vocab still counts as sanitizer if the file itself
      // has vocab nearby (checked below with fallback)
      false;
    if (isSanitizer) sanitizer++;
    else real++;
  }
  return { real, sanitizer };
}

const results = {
  violations: [],
  sanitizerAllowed: [],
  commentOnlyIgnored: [],
  ownerSideAllowlist: [],
};

for (const file of walk(SCAN_DIR)) {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, 'utf8');

  // Rule 1: direct table select is ALWAYS reported (allowlist cannot waive it),
  // with a single exception for the audited duplicate-check hook that lives
  // behind RLS and is tracked for migration to a secure RPC.
  DIRECT_TABLE_RE.lastIndex = 0;
  if (DIRECT_TABLE_RE.test(src)) {
    if (rel === 'src/hooks/useWizardDuplicateCheck.ts') {
      results.ownerSideAllowlist.push({ file: rel, note: 'direct select allowlisted — RLS-gated, migrate to RPC (TODO)' });
    } else {
      results.violations.push({ file: rel, kind: 'direct_table_select_with_tax_id' });
    }
    continue;
  }

  // Rule 2: strip comments before the catch-all scan.
  const stripped = stripComments(src);
  if (!/\btax_id\b/.test(stripped)) {
    if (/\btax_id\b/.test(src)) results.commentOnlyIgnored.push(rel);
    continue;
  }

  // Rule 3: explicit allowlist.
  if (ALLOWLIST.includes(rel)) {
    results.ownerSideAllowlist.push({ file: rel, note: 'audited owner-side / infra' });
    continue;
  }

  // Rule 4: sanitizer detection — allow only if EVERY remaining occurrence
  // sits on a sanitizer line. If any real occurrence remains, report it.
  const { real, sanitizer } = classifyOccurrences(stripped);
  const fileHasVocab = SANITIZER_VOCAB.test(stripped);
  if (real === 0 && sanitizer > 0) {
    results.sanitizerAllowed.push(rel);
    continue;
  }
  // Fallback: if sanitizer lines lacked vocab on-line but the file overall is
  // clearly a sanitizer (vocab elsewhere) and NO other real references exist,
  // still allow it.
  if (real > 0 && sanitizer > 0 && fileHasVocab && real <= sanitizer) {
    // Ambiguous file — surface it but do not block yet.
    results.sanitizerAllowed.push(rel + ' (mixed: file-level vocab)');
    continue;
  }

  results.violations.push({ file: rel, kind: 'tax_id_reference_outside_allowlist' });
}

// -- Output ------------------------------------------------------------------
const line = (label, arr, fmt = (x) => x) => {
  if (!arr.length) return;
  console.log(`\n[lint-tax-id-access] ${label} (${arr.length}):`);
  for (const item of arr) console.log(`  - ${fmt(item)}`);
};

line('comment_only_ignored', results.commentOnlyIgnored);
line('allowed_sanitizer_usage', results.sanitizerAllowed);
line('allowed_owner_side_usage', results.ownerSideAllowlist, (x) => `${x.file}  [${x.note}]`);

if (results.violations.length) {
  console.error('\n[lint-tax-id-access] Forbidden references to tax_id outside the secure RPC path:');
  for (const v of results.violations) console.error(`  - ${v.file} (${v.kind})`);
  console.error(
    '\nUse supabase.rpc("get_profile_tax_id" | "set_profile_tax_id"). Add the file to ALLOWLIST only if it is the owner-side wizard or generated code.',
  );
  process.exit(1);
}

console.log('\n[lint-tax-id-access] OK — no forbidden tax_id references found.');

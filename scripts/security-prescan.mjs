#!/usr/bin/env node
/**
 * Pré-scan de segurança executado ANTES de cada publicação.
 *
 * Objetivo: descobrir achados bloqueantes antes do deploy, em vez de
 * descobrir só quando o publish falha.
 *
 * Checagens (read-only):
 *   1. Tabelas em `public` sem RLS habilitada.
 *   2. Tabelas com RLS habilitada e ZERO policies (dados inacessíveis / suspeito).
 *   3. Policies de UPDATE (ou ALL) sem `WITH CHECK`.
 *   4. Policies permissivas para `anon` em tabelas sensíveis.
 *   5. Funções SECURITY DEFINER executáveis por `anon` fora da allowlist.
 *
 * Conexão: usa `SUPABASE_DB_URL` (postgres connection string).
 * Sem a variável, o script emite aviso e sai com 0 (não bloqueia dev local).
 *
 * Uso:
 *   node scripts/security-prescan.mjs            # falha em achados críticos
 *   node scripts/security-prescan.mjs --strict   # falha também em avisos
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STRICT = process.argv.includes("--strict");

const SENSITIVE_TABLES = [
  "profiles",
  "providers",
  "leads",
  "sponsor_leads",
  "chat_conversations",
  "chat_messages",
  "user_roles",
  "notifications",
  "support_tickets",
];

/**
 * Escritas públicas intencionais (formulários anônimos do portal),
 * já protegidas por triggers/validação server-side.
 */
const PUBLIC_WRITE_ALLOWLIST = new Set([
  "leads.Anyone can create leads",
  "open_leads.Anyone can create open leads",
  "sponsor_leads.Anyone can submit sponsor lead",
  "search_demand_logs.Anyone can insert demand logs",
  "coverage_search_log.anyone can insert valid coverage log",
  "pwa_install_events.Anyone can insert pwa events",
  "performance_reports.Anyone can create bounded performance reports",
  "onboarding_events.anyone can insert telemetry",
  "auth_profile_metrics.auth_profile_metrics: anon insert no user",
]);

/** Policies que existem para NEGAR (qual/with_check = false) não são achados. */
const isDenyPolicy = (row) =>
  /^\s*false\s*$/i.test(row.with_check || "") || /^\s*false\s*$/i.test(row.qual || "");

function loadAllowlist() {
  const p = path.join(__dirname, "rpc-grants-allowlist.json");
  if (!existsSync(p)) return [];
  try {
    const raw = JSON.parse(readFileSync(p, "utf8"));
    const list = Array.isArray(raw) ? raw : raw.anon_executable || raw.allowed || [];
    return list.map((x) => (typeof x === "string" ? x : x.function || x.name)).filter(Boolean);
  } catch {
    return [];
  }
}

const QUERIES = {
  rls_disabled: `
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
    ORDER BY 1`,
  rls_no_policies: `
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = c.relname)
    ORDER BY 1`,
  update_without_with_check: `
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd IN ('UPDATE','ALL')
      AND with_check IS NULL
    ORDER BY 1,2`,
  anon_policies_sensitive: `
    SELECT tablename, policyname, cmd, roles::text AS roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
      AND cmd <> 'SELECT'
      -- só é achado quando NÃO há amarração a usuário/role autenticado
      AND coalesce(with_check, '') !~* '(auth\\.uid|has_role|auth\\.role|current_setting)'
      AND coalesce(qual, '') !~* '(auth\\.uid|has_role|auth\\.role|current_setting)'
    ORDER BY 1,2`,
  anon_security_definer: `
    SELECT p.proname AS function_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
    ORDER BY 1`,
};

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.warn("[security-prescan] SUPABASE_DB_URL ausente — pré-scan ignorado (não bloqueante).");
    process.exit(0);
  }

  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.warn("[security-prescan] pacote `pg` indisponível — pré-scan ignorado.");
    process.exit(0);
  }

  const client = new pg.default.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const results = {};
  for (const [key, sql] of Object.entries(QUERIES)) {
    results[key] = (await client.query(sql)).rows;
  }
  await client.end();

  const allowlist = new Set(loadAllowlist());
  const critical = [];
  const warnings = [];

  for (const r of results.rls_disabled) {
    critical.push(`RLS desabilitada em public.${r.table_name}`);
  }
  for (const r of results.rls_no_policies) {
    warnings.push(`RLS ativa sem nenhuma policy em public.${r.table_name}`);
  }
  for (const r of results.update_without_with_check) {
    const msg = `Policy ${r.cmd} sem WITH CHECK: ${r.tablename}."${r.policyname}"`;
    (SENSITIVE_TABLES.includes(r.tablename) ? critical : warnings).push(msg);
  }
  for (const r of results.anon_policies_sensitive) {
    const key = `${r.tablename}.${r.policyname}`;
    if (isDenyPolicy(r) || PUBLIC_WRITE_ALLOWLIST.has(key)) continue;
    const msg = `Escrita liberada para anon/public: ${r.tablename}."${r.policyname}" (${r.cmd})`;
    (SENSITIVE_TABLES.includes(r.tablename) ? critical : warnings).push(msg);
  }
  for (const r of results.anon_security_definer) {
    if (!allowlist.has(r.function_name)) {
      warnings.push(`SECURITY DEFINER executável por anon fora da allowlist: ${r.function_name}()`);
    }
  }

  const line = (s) => console.log(`  - ${s}`);
  console.log("\n=== PRÉ-SCAN DE SEGURANÇA ===");
  if (critical.length) {
    console.log(`\nCRÍTICOS (${critical.length}):`);
    critical.forEach(line);
  } else {
    console.log("\nCRÍTICOS: nenhum");
  }
  if (warnings.length) {
    console.log(`\nAVISOS (${warnings.length}):`);
    warnings.forEach(line);
  } else {
    console.log("AVISOS: nenhum");
  }
  console.log("");

  if (critical.length || (STRICT && warnings.length)) {
    console.error("[security-prescan] BLOQUEADO — corrija os achados acima antes de publicar.");
    process.exit(1);
  }
  console.log("[security-prescan] OK — liberado para publicar.");
}

main().catch((err) => {
  console.error("[security-prescan] erro inesperado:", err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Security headers regression check.
 *
 * Faz HEAD/GET nas rotas-chave da app publicada e valida que headers de
 * segurança esperados estão presentes. Falha o processo (exit 1) em regressão.
 *
 * Uso:
 *   BASE_URL=https://precisodeum.com.br node scripts/check-security-headers.mjs
 *
 * Pode rodar em CI (GitHub Actions) ou localmente.
 */

const BASE_URL = (process.env.BASE_URL ?? "https://precisodeum.com.br").replace(/\/$/, "");

/** Rotas-alvo. Cada uma define quais headers são obrigatórios. */
const ROUTES = [
  { path: "/",                  required: ["content-security-policy", "x-content-type-options", "referrer-policy"] },
  { path: "/buscar",            required: ["content-security-policy", "x-content-type-options"] },
  { path: "/categoria/eletricista", required: ["content-security-policy", "x-content-type-options"] },
  { path: "/login",             required: ["content-security-policy", "x-content-type-options", "x-frame-options"] },
  { path: "/admin",             required: ["content-security-policy", "x-content-type-options", "x-frame-options"] },
];

/** Headers que, se presentes, são checados quanto a valores mínimos. */
const VALUE_CHECKS = {
  "x-content-type-options": (v) => v?.toLowerCase() === "nosniff",
  "x-frame-options":        (v) => ["deny", "sameorigin"].includes(v?.toLowerCase() ?? ""),
  "referrer-policy":        (v) => !!v && v.length > 0,
};

let failures = 0;

for (const route of ROUTES) {
  const url = `${BASE_URL}${route.path}`;
  let res;
  try {
    res = await fetch(url, { method: "GET", redirect: "manual" });
  } catch (err) {
    console.error(`[FAIL] ${url} — fetch error: ${err.message}`);
    failures++;
    continue;
  }

  const headers = Object.fromEntries([...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
  const problems = [];

  for (const name of route.required) {
    if (!(name in headers)) {
      problems.push(`missing header: ${name}`);
    } else if (VALUE_CHECKS[name] && !VALUE_CHECKS[name](headers[name])) {
      problems.push(`invalid value for ${name}: "${headers[name]}"`);
    }
  }

  if (problems.length) {
    console.error(`[FAIL] ${url} (HTTP ${res.status})`);
    problems.forEach(p => console.error(`   - ${p}`));
    failures++;
  } else {
    console.log(`[ OK ] ${url} (HTTP ${res.status})`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} route(s) failed security headers check.`);
  process.exit(1);
}
console.log("\nAll routes passed security headers check.");

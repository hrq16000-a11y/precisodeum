#!/usr/bin/env node
// Gera relatório markdown a partir de k6 --summary-export=summary.json
// Uso: node scripts/k6-report.mjs /tmp/k6-summary.json > /mnt/documents/k6-report.md
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("uso: node scripts/k6-report.mjs <summary.json>");
  process.exit(1);
}
const s = JSON.parse(readFileSync(path, "utf8"));
const m = s.metrics ?? {};
const get = (k, f = "p(95)") => m[k]?.values?.[f] ?? m[k]?.values?.avg ?? null;

const p95Http = get("http_req_duration", "p(95)");
const p95Search = get("search_latency", "p(95)") ?? p95Http;
const errRate = m.http_req_failed?.values?.rate ?? 0;
const reqs = m.http_reqs?.values?.count ?? 0;
const vus = m.vus_max?.values?.max ?? 0;
const iter = m.iterations?.values?.count ?? 0;

const slo = 500;
const passSlo = p95Search != null && p95Search < slo;
const passErr = errRate < 0.01;

// Heurística de gargalo
let gargalo = "indeterminado";
if (p95Search != null) {
  if (p95Search > 1500) gargalo = "**Latência/CPU do banco** — RPC saturando o plano de execução";
  else if (p95Search > 500 && errRate < 0.005) gargalo = "**CPU do banco** — provável saturação de workers PostGIS";
  else if (errRate > 0.02) gargalo = "**Connection pool / I/O** — esgotamento de conexões ou disco";
  else gargalo = "**Sem gargalo relevante** — sistema dentro do SLO";
}

const recIndex = p95Search != null && p95Search > 250 ? "Sim — investigar GIST parcial e CTE de ranking" : "Não — índices GIST atuais suficientes";
const recPool = (errRate > 0.01 || (p95Search ?? 0) > 500) ? "Sim — migrar para Supavisor transaction mode" : "Não — pooler default é suficiente";

console.log(`# Relatório k6 — nearby_providers
Gerado: ${new Date().toISOString()}

## Resultados
- VUs máximos: **${vus}**
- Iterações: **${iter}**
- Requisições: **${reqs}**
- p95 HTTP geral: **${p95Http?.toFixed(1) ?? "n/a"} ms**
- p95 busca (\`search_latency\`): **${p95Search?.toFixed(1) ?? "n/a"} ms**
- Taxa de erro: **${(errRate * 100).toFixed(2)}%**

## SLOs
- p95 < 500ms: ${passSlo ? "✅ PASS" : "❌ FAIL"}
- erro < 1%: ${passErr ? "✅ PASS" : "❌ FAIL"}

## Veredito
- Gargalo: ${gargalo}
- Justifica revisão de índices GIST? ${recIndex}
- Precisa Supavisor mais agressivo? ${recPool}

## Comparação com auditoria SQL (baseline read-only)
- Baseline EXPLAIN ANALYZE: 56–101 ms (cache quente, shared_hit ~99.9%)
- Carga atual mediu p95 de ${p95Search?.toFixed(1) ?? "n/a"} ms — ${passSlo ? "dentro" : "FORA"} do SLO.
`);

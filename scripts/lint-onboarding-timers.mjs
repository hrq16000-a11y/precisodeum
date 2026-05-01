#!/usr/bin/env node
/**
 * Onboarding Timers / Listeners Lint
 *
 * Falha o CI quando um componente do onboarding adiciona um novo
 * `setTimeout` / `setInterval` / `addEventListener` SEM cleanup
 * adequado (ou sem usar o helper `scheduleWizardTimeout`).
 *
 * Heurística por arquivo (não por ocorrência) — pragmática e tolerante
 * a falsos positivos clássicos (testes, comentários, util pura). Para cada
 * arquivo TS/TSX dentro do escopo:
 *
 *   1. Conta ocorrências relevantes:
 *        - timers ......: `setTimeout(` `setInterval(` (excluindo `clearTimeout`)
 *        - listeners ...: `.addEventListener(`
 *      Excluímos linhas dentro de comentários `//` ou `/* ... *​/`.
 *
 *   2. Conta sinais de cleanup:
 *        - `clearTimeout` / `clearInterval`
 *        - `removeEventListener`
 *        - uso de `scheduleWizardTimeout` (já é instrumentado e cleanup-friendly)
 *        - retorno de função em `useEffect` (`return () =>` no arquivo)
 *
 *   3. Regra: se há timers/listeners, exigimos pelo menos 1 sinal de cleanup
 *      no mesmo arquivo. Caso contrário, falha.
 *
 * Escopo (intencionalmente restrito ao onboarding/wizard):
 *   - src/components/onboarding/**​/*.{ts,tsx}
 *   - src/components/dashboard/DashboardTour.tsx
 *   - src/pages/CadastroInicialPage.tsx
 *   - src/pages/OnboardingV2SuccessPage.tsx
 *   - src/components/onboarding/wizard/**​/*.{ts,tsx} (já coberto pelo glob acima)
 *
 * Allowlist (`ALLOW_FILES`): arquivos puramente cosméticos sem state crítico
 * que reconhecidamente não precisam da regra (ex.: helpers de áudio).
 *
 * Uso:
 *   node scripts/lint-onboarding-timers.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();

/** Diretórios escaneados recursivamente. */
const SCAN_DIRS = [
  'src/components/onboarding',
];

/** Arquivos avulsos sempre incluídos (mesmo fora dos dirs acima). */
const EXTRA_FILES = [
  'src/components/dashboard/DashboardTour.tsx',
  'src/pages/CadastroInicialPage.tsx',
  'src/pages/OnboardingV2SuccessPage.tsx',
];

/** Arquivos isentos da regra (justificativa explícita). */
const ALLOW_FILES = new Set([
  // Helpers de áudio WebAudio — usam setTimeout só pra agendar tons curtos
  // dentro da própria função (sem state React). Cleanup é desnecessário.
  // Adicione com cuidado e SEMPRE com comentário justificando.
]);

/** Extensões válidas. */
const EXTS = new Set(['.ts', '.tsx']);

/** Padrões de timers/listeners a exigir cleanup. */
const TIMER_RE = /\b(setTimeout|setInterval)\s*\(/g;
const LISTENER_RE = /\.addEventListener\s*\(/g;

/** Sinais de cleanup aceitos. */
const CLEANUP_PATTERNS = [
  /\bclearTimeout\s*\(/,
  /\bclearInterval\s*\(/,
  /\bremoveEventListener\s*\(/,
  /\bscheduleWizardTimeout\s*\(/, // já é cleanup-friendly por contrato
  /return\s*\(\s*\)\s*=>/,         // useEffect cleanup function
];

/**
 * Remove conteúdo de comentários para evitar falsos positivos.
 * - Linhas iniciadas por `//` (após whitespace).
 * - Blocos `/* ... *​/` (mesmo multi-linha).
 */
function stripComments(src) {
  // Block comments (greedy, multi-line aware via dot-all flag).
  let out = src.replace(/\/\*[\s\S]*?\*\//g, '');
  // Line comments — preserva o newline.
  out = out.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  return out;
}

function shouldScan(absPath) {
  if (!EXTS.has(absPath.slice(absPath.lastIndexOf('.')))) return false;
  if (absPath.endsWith('.test.ts') || absPath.endsWith('.test.tsx')) return false;
  if (absPath.endsWith('.d.ts')) return false;
  return true;
}

function walk(dir, acc) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      // Pula __tests__ e node_modules (defensivo).
      if (name === '__tests__' || name === 'node_modules') continue;
      walk(full, acc);
    } else if (st.isFile() && shouldScan(full)) {
      acc.push(full);
    }
  }
}

function collectFiles() {
  const files = [];
  for (const d of SCAN_DIRS) walk(join(ROOT, d), files);
  for (const f of EXTRA_FILES) {
    const abs = join(ROOT, f);
    try {
      if (statSync(abs).isFile()) files.push(abs);
    } catch { /* não existe — ignora */ }
  }
  // Dedupe e normaliza separadores.
  return Array.from(new Set(files));
}

function analyzeFile(absPath) {
  const rel = relative(ROOT, absPath).split(sep).join('/');
  if (ALLOW_FILES.has(rel)) return null;

  const raw = readFileSync(absPath, 'utf8');
  const src = stripComments(raw);

  const timerHits = (src.match(TIMER_RE) || []).length;
  const listenerHits = (src.match(LISTENER_RE) || []).length;

  if (timerHits === 0 && listenerHits === 0) return null;

  const hasCleanup = CLEANUP_PATTERNS.some((re) => re.test(src));
  if (hasCleanup) return null;

  return {
    file: rel,
    timers: timerHits,
    listeners: listenerHits,
  };
}

function main() {
  const files = collectFiles();
  const violations = [];
  for (const f of files) {
    const v = analyzeFile(f);
    if (v) violations.push(v);
  }

  console.log(`[lint-onboarding-timers] scanned ${files.length} files`);

  if (violations.length === 0) {
    console.log('[lint-onboarding-timers] OK — no uncleaned timers/listeners detected.');
    process.exit(0);
  }

  console.error('\n[lint-onboarding-timers] FAIL — onboarding files declare timers/listeners without cleanup signal:\n');
  for (const v of violations) {
    const parts = [];
    if (v.timers) parts.push(`${v.timers} timer(s)`);
    if (v.listeners) parts.push(`${v.listeners} listener(s)`);
    console.error(`  - ${v.file}  →  ${parts.join(' + ')}`);
  }
  console.error([
    '',
    'Required: each onboarding file with setTimeout/setInterval/addEventListener',
    'must include AT LEAST ONE of: clearTimeout/clearInterval/removeEventListener,',
    'a useEffect cleanup `return () => ...`, or scheduleWizardTimeout().',
    '',
    'Fixes:',
    '  1. Wrap timers in `scheduleWizardTimeout({ phase, action }, fn, ms)` from',
    '     `@/lib/wizardZombieGuard` — preferred for wizard phases (auto telemetry).',
    '  2. Track refs with `useRef<number | null>` and clear in useEffect return.',
    '  3. Pair every addEventListener with removeEventListener in the same effect.',
    '',
    'If a file is genuinely exempt, add it to ALLOW_FILES with a justification comment.',
    '',
  ].join('\n'));
  process.exit(1);
}

main();

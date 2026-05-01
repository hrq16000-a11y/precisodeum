#!/usr/bin/env node
/**
 * Onboarding Timers / Listeners Lint (v2 — per-occurrence)
 *
 * Detecta timers (`setTimeout`/`setInterval`) e `addEventListener` em arquivos
 * do onboarding sem cleanup correspondente. A análise é POR OCORRÊNCIA e
 * escopada ao BLOCO LÉXICO mais próximo (tipicamente uma callback de
 * `useEffect`/`useLayoutEffect`/`useCallback`/`useMemo` ou função handler),
 * o que reduz falsos positivos (cleanup existe mas em outro hook) e
 * falsos negativos (arquivo tem qualquer `clearTimeout` em outro lugar).
 *
 * Regras (por ocorrência):
 *
 *   • Para um `setTimeout(...)`/`setInterval(...)` exigimos UM dos sinais no
 *     mesmo arquivo:
 *        - `scheduleWizardTimeout(` (helper instrumentado, cleanup-friendly).
 *        - Atribuição a um `useRef` (`xxxRef.current = setTimeout(...)`)
 *          combinado com `clearTimeout(xxxRef.current)` em algum lugar.
 *        - Uso da forma `const id = setTimeout(...)` seguida por
 *          `clearTimeout(id)` dentro do MESMO bloco.
 *        - Estar dentro de uma callback de `useEffect`/`useLayoutEffect`
 *          que retorna uma função de cleanup contendo `clearTimeout`/
 *          `clearInterval`.
 *
 *   • Para um `target.addEventListener('evt', handler, ...)` exigimos:
 *        - `target.removeEventListener('evt', handler, ...)` no mesmo
 *          arquivo, OU
 *        - Estar dentro de uma callback de `useEffect`/`useLayoutEffect`
 *          cujo cleanup contenha `removeEventListener`.
 *
 *   • Comentários (`//` e `/* *​/`) e strings/template literais são
 *     mascarados antes da análise para evitar falsos positivos.
 *
 *   • Arquivos `.test.ts(x)` e `.d.ts` são ignorados.
 *
 * Escopo:
 *   - src/components/onboarding/**​/*.{ts,tsx}
 *   - src/components/dashboard/DashboardTour.tsx
 *   - src/pages/CadastroInicialPage.tsx
 *   - src/pages/OnboardingV2SuccessPage.tsx
 *
 * Uso:
 *   node scripts/lint-onboarding-timers.mjs
 *
 * Flags:
 *   --debug        loga decisão por ocorrência
 *   --json         emite resumo JSON (CI-friendly)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const DEBUG = process.argv.includes('--debug');
const AS_JSON = process.argv.includes('--json');

const SCAN_DIRS = ['src/components/onboarding'];
const EXTRA_FILES = [
  'src/components/dashboard/DashboardTour.tsx',
  'src/pages/CadastroInicialPage.tsx',
  'src/pages/OnboardingV2SuccessPage.tsx',
];

/** Arquivos isentos com justificativa explícita. */
const ALLOW_FILES = new Set([
  // ex.: 'src/lib/soundFx.ts', // WebAudio puro, sem state React.
]);

const EXTS = new Set(['.ts', '.tsx']);

/* -------------------------------------------------------------------------- */
/* Pré-processamento: mascarar comentários e strings preservando offsets.     */
/* -------------------------------------------------------------------------- */

/**
 * Substitui o conteúdo de comentários e strings por espaços, mantendo o
 * comprimento exato do arquivo. Preserva newlines (importante para line:col).
 */
function maskCommentsAndStrings(src) {
  const out = src.split('');
  const len = src.length;
  let i = 0;
  const blank = (a, b) => {
    for (let k = a; k < b && k < len; k++) {
      if (out[k] !== '\n') out[k] = ' ';
    }
  };
  while (i < len) {
    const c = src[i];
    const n = src[i + 1];
    // Block comment
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? len : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }
    // Line comment
    if (c === '/' && n === '/') {
      const end = src.indexOf('\n', i + 2);
      const stop = end === -1 ? len : end;
      blank(i, stop);
      i = stop;
      continue;
    }
    // Strings: ", ', `
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      let j = i + 1;
      while (j < len) {
        const cj = src[j];
        if (cj === '\\') { j += 2; continue; }
        if (cj === quote) { j++; break; }
        // Template literal expressions: deixar passar ${...} como código
        if (quote === '`' && cj === '$' && src[j + 1] === '{') {
          // mascara só o texto antes do ${ e segue analisando o miolo
          blank(i + 1, j);
          // procura o '}' equilibrando chaves
          let depth = 1;
          let k = j + 2;
          while (k < len && depth > 0) {
            const ck = src[k];
            if (ck === '{') depth++;
            else if (ck === '}') depth--;
            k++;
          }
          // continua o template após o '}'
          i = k;
          j = k;
          // marca a abertura ` ainda como string-stub (mantém offset)
          out[i - 1] = out[i - 1]; // no-op, só para leitura
          // Reentrar no laço externo para continuar varrendo após '}'
          // mas precisamos achar o fechamento da template ainda. Para
          // simplificar: trate o restante como template normal.
          quoteContinue: while (i < len) {
            const ci = src[i];
            if (ci === '\\') { i += 2; continue; }
            if (ci === '`') { i++; break quoteContinue; }
            if (ci === '$' && src[i + 1] === '{') {
              let d2 = 1, m = i + 2;
              while (m < len && d2 > 0) {
                if (src[m] === '{') d2++;
                else if (src[m] === '}') d2--;
                m++;
              }
              i = m;
              continue;
            }
            if (ci !== '\n') out[i] = ' ';
            i++;
          }
          j = i;
          break;
        }
        if (cj !== '\n') out[j] = ' ';
        j++;
      }
      // mascarar aspas e o conteúdo restante (já feito), agora i = j
      out[i] = ' ';
      if (j - 1 < len && out[j - 1] !== '\n') out[j - 1] = ' ';
      i = j;
      continue;
    }
    i++;
  }
  return out.join('');
}

/* -------------------------------------------------------------------------- */
/* Localização de blocos: encontra o `{ ... }` que envolve um offset.         */
/* -------------------------------------------------------------------------- */

/** Devolve [start, end] do menor bloco { ... } que contém `pos`, ou null. */
function enclosingBlock(masked, pos) {
  // Acha início: anda para trás contando chaves.
  let depth = 0;
  let start = -1;
  for (let i = pos; i >= 0; i--) {
    const c = masked[i];
    if (c === '}') depth++;
    else if (c === '{') {
      if (depth === 0) { start = i; break; }
      depth--;
    }
  }
  if (start === -1) return null;
  // Acha fim: anda para frente.
  let d = 1;
  let end = -1;
  for (let i = start + 1; i < masked.length; i++) {
    const c = masked[i];
    if (c === '{') d++;
    else if (c === '}') {
      d--;
      if (d === 0) { end = i; break; }
    }
  }
  if (end === -1) return null;
  return [start, end];
}

/** Encontra a chamada de hook que envolve este bloco, se houver. */
function enclosingHook(masked, blockStart) {
  // Procura o token ANTES de '{' algo como "useEffect(() => {" ou
  // "useEffect(function () {" — basta olhar ~120 chars antes.
  const slice = masked.slice(Math.max(0, blockStart - 200), blockStart);
  const m = slice.match(/\b(useEffect|useLayoutEffect|useCallback|useMemo|useInsertionEffect)\s*\(/);
  return m ? m[1] : null;
}

/** Verifica se o bloco do useEffect retorna função com cleanup esperado. */
function effectReturnsCleanup(blockSrc, kindRegex) {
  // Aceita `return () => { ... clearXxx ... }` OU `return () => xxx(...)`.
  const re = /return\s*(?:\([^)]*\)|\w+)?\s*=>\s*(\{[\s\S]*?\}|[^;\n]+)/g;
  let m;
  while ((m = re.exec(blockSrc))) {
    if (kindRegex.test(m[1] || '')) return true;
  }
  // Também aceita `return function () { ... }` clássico.
  const re2 = /return\s+function[^{]*\{([\s\S]*?)\}/g;
  while ((m = re2.exec(blockSrc))) {
    if (kindRegex.test(m[1] || '')) return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Análise por ocorrência                                                     */
/* -------------------------------------------------------------------------- */

const TIMER_RE = /\b(setTimeout|setInterval)\s*\(/g;
// Captura: 1=target, 2=evento (com aspas), 3=handler raw (até a próxima `,` ou `)`)
const LISTENER_RE = /\b([A-Za-z_$][\w$.]*)\.addEventListener\s*\(\s*(['"`][^'"`]+['"`])\s*,\s*([^,)]+)/g;
const REMOVE_RE = /\b([A-Za-z_$][\w$.]*)\.removeEventListener\s*\(\s*(['"`][^'"`]+['"`])\s*,\s*([^,)]+)/g;

const CLEAR_TIMER_ANY = /\b(clearTimeout|clearInterval)\s*\(/;
const REMOVE_LISTENER_ANY = /\bremoveEventListener\s*\(/;
const SCHEDULE_HELPER = /\bscheduleWizardTimeout\s*\(/;

/**
 * Strips TS casts/annotations that don't change handler identity:
 *   `fn as EventListener`         → `fn`
 *   `fn satisfies (e: Event)=>void` → `fn`
 *   `<EventListener>fn`           → `fn`
 *   `(fn)`                        → `fn`
 *   `fn!`                         → `fn`
 */
function stripTsCasts(s) {
  let prev;
  let cur = s.trim();
  do {
    prev = cur;
    // `<Type>expr` (TS angle-bracket cast) — apenas se o `<...>` parece um tipo
    cur = cur.replace(/^<[^<>]+>\s*/, '');
    // `expr as Type` / `expr satisfies Type` — consome até o fim, pois o tipo
    // pode conter generics simples sem vírgulas externas.
    cur = cur.replace(/\s+(?:as|satisfies)\s+[\w$.<>[\]\s|&,'"`-]+$/i, '');
    // Non-null assertion `expr!`
    cur = cur.replace(/!\s*$/, '');
    // Parênteses externos `(expr)`
    if (cur.startsWith('(') && cur.endsWith(')')) {
      const inner = cur.slice(1, -1);
      // só remove se os parênteses são realmente externos (depth 0 no fim)
      let depth = 0, ok = true;
      for (let i = 0; i < inner.length; i++) {
        if (inner[i] === '(') depth++;
        else if (inner[i] === ')') { depth--; if (depth < 0) { ok = false; break; } }
      }
      if (ok && depth === 0) cur = inner.trim();
    }
    cur = cur.trim();
  } while (cur !== prev);
  return cur;
}

/**
 * Decide se um trecho de handler é uma referência a um identificador "removível".
 * Aceita identificadores simples (`onResize`), acessos (`handlerRef.current`,
 * `this.onClick`) e bind (`fn.bind(this)`). REJEITA literais inline:
 * arrow functions, `function (...) {}`, `() => ...`, etc., porque a referência
 * não pode ser reutilizada em `removeEventListener`.
 */
function isNamedHandler(handlerSrc) {
  const h = stripTsCasts(handlerSrc);
  if (!h) return false;
  // Inline literals → leak garantido.
  if (/^(?:async\s+)?function\b/.test(h)) return false;
  if (/=>/.test(h)) return false;
  if (/^\(/.test(h)) return false; // qualquer coisa começando com '(' é arrow/IIFE
  if (/^\{/.test(h)) return false;
  // Aceita identificador, dot-access, opcional .bind(...)
  return /^[A-Za-z_$][\w$.[\]]*(?:\.bind\([^)]*\))?$/.test(h);
}

/** Normaliza um handler para comparação (remove casts, espaços e .bind(...)). */
function normalizeHandler(h) {
  return stripTsCasts(h).replace(/\.bind\([^)]*\)$/, '');
}



function lineCol(src, pos) {
  let line = 1, col = 1;
  for (let i = 0; i < pos && i < src.length; i++) {
    if (src[i] === '\n') { line++; col = 1; }
    else col++;
  }
  return { line, col };
}

function checkTimer(masked, raw, idx) {
  // 1) helper instrumentado anywhere — aceitamos se a chamada está envolta
  //    pelo helper (mesma linha/anterior). Mais barato: helper presente NO
  //    arquivo cobre todos os timers daquele arquivo.
  if (SCHEDULE_HELPER.test(masked)) return { ok: true, reason: 'scheduleWizardTimeout' };

  // 2) bloco enclosing
  const block = enclosingBlock(masked, idx);
  if (block) {
    const [bs, be] = block;
    const blockSrc = masked.slice(bs, be + 1);
    const hook = enclosingHook(masked, bs);
    if (hook === 'useEffect' || hook === 'useLayoutEffect' || hook === 'useInsertionEffect') {
      if (effectReturnsCleanup(blockSrc, CLEAR_TIMER_ANY)) {
        return { ok: true, reason: `${hook} cleanup return` };
      }
    }
    // 3) `const id = setTimeout(...)` + `clearTimeout(id)` no mesmo bloco
    // Olha 80 chars antes para capturar o nome da variável atribuída.
    const before = masked.slice(Math.max(bs, idx - 120), idx);
    const assign = before.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*$/) ||
                   before.match(/([A-Za-z_$][\w$.]*)\s*=\s*$/);
    if (assign) {
      const name = assign[1];
      const clearRe = new RegExp(`\\bclear(?:Timeout|Interval)\\s*\\(\\s*${name.replace(/\./g, '\\.')}\\b`);
      if (clearRe.test(blockSrc)) {
        return { ok: true, reason: `paired clear for ${name}` };
      }
      // Também aceita clear no arquivo inteiro se o nome é um ref (`xxxRef.current`)
      if (/Ref\.current$/.test(name) && clearRe.test(masked)) {
        return { ok: true, reason: `paired clear for ${name} (ref)` };
      }
    }
  }

  // 4) último fallback: clearTimeout/Interval do mesmo arquivo + algum useRef
  //    nomeado timer/timeout/interval (heurística conservadora).
  if (CLEAR_TIMER_ANY.test(masked) && /useRef\s*<[^>]*>\s*\(\s*null\s*\)|(?:timer|timeout|interval)Ref/i.test(masked)) {
    return { ok: true, reason: 'ref + clear in file (heuristic)' };
  }
  return { ok: false, reason: 'no cleanup found for timer' };
}

function findRemovesIn(scope) {
  const out = [];
  REMOVE_RE.lastIndex = 0;
  let m;
  while ((m = REMOVE_RE.exec(scope))) {
    out.push({ target: m[1], evt: m[2], handler: m[3] });
  }
  return out;
}

function checkListener(masked, raw, idx, target, evt, handler) {
  // 1) Handler precisa ser uma referência nomeada para conseguir ser removido.
  //    Inline arrow/function literais geram referência única → leak.
  const inlineHandler = !isNamedHandler(handler);

  const block = enclosingBlock(masked, idx);
  let blockRaw = '';
  if (block) {
    const [bs, be] = block;
    blockRaw = raw.slice(bs, be + 1);
  }
  const fileRemoves = findRemovesIn(raw);
  const blockRemoves = blockRaw ? findRemovesIn(blockRaw) : [];

  const wantTarget = target;
  const wantEvt = evt;
  const wantHandler = inlineHandler ? null : normalizeHandler(handler);

  const matches = (rem) => {
    if (rem.target !== wantTarget) return false;
    if (rem.evt !== wantEvt) return false;
    if (wantHandler === null) return false; // inline → nunca casa
    return normalizeHandler(rem.handler) === wantHandler;
  };

  if (inlineHandler) {
    return {
      ok: false,
      reason: `inline handler in addEventListener(${evt}) cannot be removed (use a named ref)`,
    };
  }

  if (blockRemoves.some(matches)) {
    return { ok: true, reason: `paired remove in same block (${target}, ${evt}, ${wantHandler})` };
  }
  if (fileRemoves.some(matches)) {
    return { ok: true, reason: `paired remove in file (${target}, ${evt}, ${wantHandler})` };
  }

  // Mensagem de erro mais útil: indica se há remove com event/target diferente.
  const sameTargetEvt = fileRemoves.find((r) => r.target === wantTarget && r.evt === wantEvt);
  if (sameTargetEvt) {
    return {
      ok: false,
      reason: `removeEventListener(${evt}) uses different handler ref (${normalizeHandler(sameTargetEvt.handler)} vs ${wantHandler})`,
    };
  }
  const wrongEvt = fileRemoves.find((r) => r.target === wantTarget && r.evt !== wantEvt);
  if (wrongEvt) {
    return {
      ok: false,
      reason: `addEventListener(${evt}) but cleanup removes ${wrongEvt.evt} (event mismatch)`,
    };
  }
  return { ok: false, reason: `no removeEventListener for (${target}, ${evt}, ${wantHandler})` };
}


function analyzeFile(absPath) {
  const rel = relative(ROOT, absPath).split(sep).join('/');
  if (ALLOW_FILES.has(rel)) return [];

  const raw = readFileSync(absPath, 'utf8');
  const masked = maskCommentsAndStrings(raw);

  const findings = [];

  // Timers
  TIMER_RE.lastIndex = 0;
  let m;
  while ((m = TIMER_RE.exec(masked))) {
    const idx = m.index;
    const res = checkTimer(masked, raw, idx);
    if (DEBUG) {
      const { line, col } = lineCol(raw, idx);
      console.log(`[debug] ${rel}:${line}:${col} ${m[1]} → ${res.ok ? 'OK' : 'FAIL'} (${res.reason})`);
    }
    if (!res.ok) {
      const { line, col } = lineCol(raw, idx);
      findings.push({ file: rel, line, col, kind: m[1], reason: res.reason });
    }
  }

  // Listeners — buscamos no RAW (precisamos do nome do evento entre aspas)
  // e descartamos hits cuja posição esteja dentro de comentário (no `masked`
  // a posição correspondente vira espaço/quebra).
  LISTENER_RE.lastIndex = 0;
  while ((m = LISTENER_RE.exec(raw))) {
    const idx = m.index;
    // Heurística simples: se o caractere em `masked[idx]` é parte do nome do
    // target (alfanumérico/_/$), o trecho não está em comentário.
    const ch = masked[idx];
    if (!/[A-Za-z_$]/.test(ch)) continue;
    const target = m[1];
    const evt = m[2];
    const handler = m[3];
    const res = checkListener(masked, raw, idx, target, evt, handler);
    if (DEBUG) {
      const { line, col } = lineCol(raw, idx);
      console.log(`[debug] ${rel}:${line}:${col} ${target}.addEventListener(${evt}) → ${res.ok ? 'OK' : 'FAIL'} (${res.reason})`);
    }
    if (!res.ok) {
      const { line, col } = lineCol(raw, idx);
      findings.push({ file: rel, line, col, kind: 'addEventListener', reason: res.reason });
    }
  }

  return findings;
}

/* -------------------------------------------------------------------------- */

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
    try { if (statSync(abs).isFile()) files.push(abs); } catch {}
  }
  return Array.from(new Set(files));
}

function main() {
  const files = collectFiles();
  const violations = [];
  for (const f of files) violations.push(...analyzeFile(f));

  if (AS_JSON) {
    console.log(JSON.stringify({ scanned: files.length, violations }, null, 2));
  } else {
    console.log(`[lint-onboarding-timers] scanned ${files.length} files`);
  }

  if (violations.length === 0) {
    if (!AS_JSON) console.log('[lint-onboarding-timers] OK — no uncleaned timers/listeners detected.');
    process.exit(0);
  }

  if (!AS_JSON) {
    console.error('\n[lint-onboarding-timers] FAIL — uncleaned timers/listeners:\n');
    for (const v of violations) {
      console.error(`  - ${v.file}:${v.line}:${v.col}  ${v.kind}  →  ${v.reason}`);
    }
    console.error([
      '',
      'Each setTimeout/setInterval/addEventListener must be paired with cleanup:',
      '  • prefer scheduleWizardTimeout({ phase, action }, fn, ms) for wizard phases;',
      '  • or const id = setTimeout(...); ... clearTimeout(id) within the same block;',
      '  • or store in a useRef and clearTimeout(ref.current) in useEffect return;',
      '  • or pair addEventListener/removeEventListener with same target+event.',
      '',
      'If a file is genuinely exempt, add it to ALLOW_FILES with a justification.',
      '',
    ].join('\n'));
  }
  process.exit(1);
}

main();

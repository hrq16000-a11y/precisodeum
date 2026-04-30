#!/usr/bin/env node
/**
 * Valida JSON-LD gerado em código-fonte (literais, useJsonLd payloads).
 *
 * Como funciona:
 *  - Varre src/**\/*.{ts,tsx} procurando objetos com `'@type': '...'` e `'@context'`.
 *  - Para cada `@type` reconhecido (FAQPage, BreadcrumbList, LocalBusiness,
 *    City, State, ItemList, Service, AggregateRating), aplica regras schema.org
 *    mínimas e falha se algum campo obrigatório estiver ausente ou mal-formado.
 *
 * Não substitui o validador oficial do Google, mas pega regressões no PR
 * (ex.: alguém remove `mainEntity` de um FAQPage e quebra rich snippets).
 *
 * Uso: `node scripts/validate-json-ld.mjs` — exit 1 em qualquer erro.
 */
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const REPORT_PATH = process.env.JSONLD_REPORT_PATH || join(new URL('..', import.meta.url).pathname, 'dist', 'jsonld-report.json');
const STRICT = process.argv.includes('--strict') || process.env.JSONLD_STRICT === '1';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC_DIR = join(ROOT, 'src');

/** Regras mínimas por @type. Cada regra recebe o objeto literal (string raw). */
const RULES = {
  FAQPage: {
    required: ['mainEntity'],
    must: [
      { match: /['"]@type['"]\s*:\s*['"]Question['"]/, msg: 'FAQPage deve conter Question(s) em mainEntity' },
      { match: /acceptedAnswer/, msg: 'FAQPage Question precisa de acceptedAnswer' },
    ],
  },
  BreadcrumbList: {
    required: ['itemListElement'],
    must: [
      { match: /['"]@type['"]\s*:\s*['"]ListItem['"]/, msg: 'BreadcrumbList precisa de ListItem(s)' },
      { match: /position/, msg: 'BreadcrumbList ListItem precisa de "position"' },
    ],
  },
  LocalBusiness: {
    required: ['name'],
    must: [],
  },
  Person: {
    required: ['name'],
    must: [],
  },
  Place: {
    // Place pode aparecer como referência interna (jobLocation, etc.) sem name —
    // basta address ou geo. Mantemos `name` apenas recomendado.
    required: [],
    must: [
      { match: /name|address|geo|containedInPlace/, msg: 'Place precisa de name, address, geo ou containedInPlace' },
    ],
  },
  PostalAddress: {
    required: ['addressLocality'],
    must: [],
  },
  City: { required: ['name'], must: [] },
  State: { required: ['name'], must: [] },
  Service: {
    // Service pode aparecer como ref mínima (`about: { '@type': 'Service', name }`).
    required: ['name'],
    must: [],
  },
  AggregateRating: {
    required: ['ratingValue'],
    must: [{ match: /reviewCount|ratingCount/, msg: 'AggregateRating precisa de reviewCount ou ratingCount' }],
  },
  ItemList: { required: ['itemListElement'], must: [] },
  ListItem: {
    required: ['position'],
    must: [
      { match: /name|item/, msg: 'ListItem precisa de name e/ou item (URL)' },
    ],
  },
  Question: {
    required: ['name'],
    must: [{ match: /acceptedAnswer/, msg: 'Question precisa de acceptedAnswer' }],
  },
};

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const s = statSync(path);
    if (s.isDirectory()) {
      if (name === 'node_modules' || name === '.git' || name === 'test' || name === '__tests__') continue;
      yield* walk(path);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name)) {
      yield path;
    }
  }
}

/**
 * Extrai "blocos" plausíveis de JSON-LD de um arquivo.
 * Heurística: encontra `'@type':` e expande para o objeto delimitado por chaves balanceadas.
 */
function extractBlocks(source) {
  const blocks = [];
  const re = /['"]@type['"]\s*:\s*['"]([A-Za-z]+)['"]/g;
  let m;
  while ((m = re.exec(source))) {
    const type = m[1];
    if (!RULES[type]) continue;
    // Expande para trás para encontrar a abertura `{`.
    let start = m.index;
    let depth = 0;
    let openIdx = -1;
    for (let i = m.index; i >= 0; i--) {
      if (source[i] === '}') depth++;
      else if (source[i] === '{') {
        if (depth === 0) { openIdx = i; break; }
        depth--;
      }
    }
    if (openIdx === -1) continue;
    // Avança para encontrar o `}` correspondente.
    depth = 1;
    let closeIdx = -1;
    for (let i = openIdx + 1; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) { closeIdx = i; break; }
      }
    }
    if (closeIdx === -1) continue;
    blocks.push({ type, raw: source.slice(openIdx, closeIdx + 1) });
  }
  return blocks;
}

function validateBlock({ type, raw }, file) {
  const errors = [];
  const rule = RULES[type];
  for (const field of rule.required) {
    // Aceita chaves quoted ('name':, "name":) E identifier-style (name:),
    // ambas presentes em objetos JS literais usados no código.
    const re = new RegExp(`(['"]${field}['"]|\\b${field})\\s*:`);
    if (!re.test(raw)) errors.push(`${file}: ${type} sem campo obrigatório "${field}"`);
  }
  for (const m of rule.must) {
    if (!m.match.test(raw)) errors.push(`${file}: ${type} — ${m.msg}`);
  }
  return errors;
}

let totalBlocks = 0;
const allErrors = [];
for (const file of walk(SRC_DIR)) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes("'@type'") && !src.includes('"@type"')) continue;
  const blocks = extractBlocks(src);
  totalBlocks += blocks.length;
  for (const b of blocks) {
    allErrors.push(...validateBlock(b, file.replace(ROOT, '')));
  }
}

if (allErrors.length) {
  console.error(`✗ JSON-LD inválido (${allErrors.length} erro(s) em ${totalBlocks} bloco(s)):`);
  for (const e of allErrors) console.error('  •', e);
  process.exit(1);
}

console.log(`✓ JSON-LD OK — ${totalBlocks} bloco(s) validado(s) em src/`);

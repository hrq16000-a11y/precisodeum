/**
 * heroPhraseGenerator
 * --------------------------------------------------------------
 * Gera frases do hero combinando "Preciso de um/uma" e
 * "Encontre um/uma" com o nome da categoria, aplicando regra
 * de gênero (masculino/feminino) e respeitando contrações do
 * português brasileiro.
 *
 * Em PT-BR não há contração entre "de" e o artigo indefinido
 * (mantém "de um", "de uma"). Usamos somente artigo indefinido
 * para não exigir contração com definidos ("do/da/de + os/as").
 *
 * Algoritmo anti-repetição:
 *  - Mantém um histórico das últimas N categorias mostradas em
 *    localStorage (best effort, falha silenciosa em SSR/privado).
 *  - Sorteia categorias evitando o histórico recente; quando o
 *    pool elegível esvazia, libera o item mais antigo da janela.
 *  - Usa Fisher–Yates sobre o pool elegível para garantir
 *    variação justa sem viés.
 */

export type Gender = 'm' | 'f';

export interface HeroCategoryInput {
  slug: string;
  label: string;
  /** Gênero gramatical (m | f). Se ausente, é inferido pela terminação. */
  gender?: Gender;
  /** Artigo indefinido pré-calculado. Se ausente, é derivado do gênero. */
  article?: 'um' | 'uma';
}

export interface HeroCategory extends HeroCategoryInput {
  gender: Gender;
  article: 'um' | 'uma';
}

export type PrefixKind = 'need' | 'find';

export interface HeroPhrase {
  category: HeroCategory;
  prefix: string;          // "Preciso de um" | "Encontre uma" ...
  prefixKind: PrefixKind;
  service: string;         // label
  isCallout: boolean;      // true para "find" (gera "!")
  text: string;            // frase completa: "Preciso de um pintor"
}

// ---------------------------------------------------------------
// Inferência de gênero
// ---------------------------------------------------------------

/** Palavras irregulares onde a heurística por terminação falha. */
const GENDER_OVERRIDES: Record<string, Gender> = {
  // Femininas terminadas em consoante / "a" mas ambíguas
  'babá': 'f',
  'baba': 'f',
  'recepcionista': 'f', // ambíguo, escolhemos f por uso comum (poderia ser m)
  // Masculinas terminadas em "a"
  'eletricista': 'm',
  'dentista': 'm',
  'motorista': 'm',
  'jornalista': 'm',
  'turista': 'm',
  'azulejista': 'm',
  'manicure': 'f',
  'pedicure': 'f',
  // Profissionais com terminação atípica
  'designer': 'm',
  'designer gráfico': 'm',
  'designer gráfica': 'f',
  'gerente': 'm',
  'cliente': 'm',
};

/**
 * Infere o gênero a partir da terminação do label.
 * Regras (PT-BR, simplificadas):
 *  - termina em "a" / "ã" / "agem" / "ção" / "dade" / "ice" → feminino
 *  - termina em "o" / "or" / "eiro" / "ário" / "ista" (irreg) → masculino
 *  - default: masculino (genérico inclusivo na propaganda)
 */
export function inferGender(label: string): Gender {
  const norm = label.trim().toLowerCase();
  if (norm in GENDER_OVERRIDES) return GENDER_OVERRIDES[norm];

  // Última palavra (em "técnico em informática", olhamos "técnico" — primeira)
  const head = norm.split(/\s+/)[0] ?? norm;

  if (/(ção|gem|dade|ice|tude|eza|ã)$/.test(head)) return 'f';
  if (/a$/.test(head)) return 'f';
  if (/(or|eiro|ário|ano|ista|inho|ano|ês)$/.test(head)) return 'm';
  if (/o$/.test(head)) return 'm';
  return 'm';
}

export function articleFor(gender: Gender): 'um' | 'uma' {
  return gender === 'f' ? 'uma' : 'um';
}

/** Normaliza um input parcial para `HeroCategory` completo. */
export function normalizeCategory(input: HeroCategoryInput): HeroCategory {
  const gender = input.gender ?? inferGender(input.label);
  const article = input.article ?? articleFor(gender);
  return { ...input, gender, article };
}

// ---------------------------------------------------------------
// Geração de frase
// ---------------------------------------------------------------

const PREFIXES: Record<PrefixKind, (article: 'um' | 'uma') => string> = {
  need: (article) => `Preciso de ${article}`,
  find: (article) => `Encontre ${article}`,
};

export function buildPhrase(category: HeroCategoryInput, kind: PrefixKind): HeroPhrase {
  const cat = normalizeCategory(category);
  const prefix = PREFIXES[kind](cat.article);
  const isCallout = kind === 'find';
  return {
    category: cat,
    prefix,
    prefixKind: kind,
    service: cat.label,
    isCallout,
    text: `${prefix} ${cat.label}${isCallout ? '!' : ''}`,
  };
}

// ---------------------------------------------------------------
// Algoritmo anti-repetição (cooldown por janela deslizante)
// ---------------------------------------------------------------

export const RECENT_HISTORY_KEY = 'hero_recent_categories_v1';
export const DEFAULT_HISTORY_SIZE = 8;

function readHistory(storage?: Storage | null): string[] {
  try {
    const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!s) return [];
    const raw = s.getItem(RECENT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeHistory(slugs: string[], storage?: Storage | null) {
  try {
    const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!s) return;
    s.setItem(RECENT_HISTORY_KEY, JSON.stringify(slugs));
  } catch {
    /* noop */
  }
}

export interface PickOptions {
  /** Tamanho máximo da janela de cooldown. Default: DEFAULT_HISTORY_SIZE. */
  historySize?: number;
  /** Random injetável para testes determinísticos. */
  random?: () => number;
  /** Storage injetável (testes). */
  storage?: Storage | null;
  /** Histórico inicial (testes). */
  seedHistory?: string[];
}

/**
 * Sorteia uma ordem de categorias evitando repetir slugs recentes.
 *
 * Estratégia:
 *  1. Filtra categorias cujo slug NÃO está na janela recente.
 *  2. Se sobrou pouco (<= 1), libera o mais antigo até dar fôlego.
 *  3. Aplica Fisher–Yates no pool elegível.
 *  4. Atualiza a janela: prepend dos novos slugs, trunca em `historySize`.
 */
export function pickNextOrder(
  categories: HeroCategoryInput[],
  options: PickOptions = {},
): { order: HeroCategory[]; nextHistory: string[] } {
  const {
    historySize = DEFAULT_HISTORY_SIZE,
    random = Math.random,
    storage = undefined,
    seedHistory,
  } = options;

  if (categories.length === 0) {
    return { order: [], nextHistory: seedHistory ?? readHistory(storage) };
  }

  const normalized = categories.map(normalizeCategory);
  // Dedup por slug preservando primeira ocorrência
  const bySlug = new Map<string, HeroCategory>();
  for (const c of normalized) if (!bySlug.has(c.slug)) bySlug.set(c.slug, c);
  const pool = Array.from(bySlug.values());

  let history = (seedHistory ?? readHistory(storage)).slice(0, historySize);

  // Garante que existam ao menos 2 elegíveis (quando possível)
  let eligible = pool.filter((c) => !history.includes(c.slug));
  while (eligible.length < Math.min(2, pool.length) && history.length > 0) {
    history = history.slice(0, history.length - 1); // libera o mais antigo
    eligible = pool.filter((c) => !history.includes(c.slug));
  }

  // Fisher–Yates determinístico via `random`
  const arr = [...eligible];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  // Anexa o restante (que estava em cooldown) ao fim, também embaralhado,
  // para que ciclos longos eventualmente revisitem todos sem repetir
  // imediatamente após reset.
  const cooldownTail = pool.filter((c) => !arr.find((x) => x.slug === c.slug));
  for (let i = cooldownTail.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cooldownTail[i], cooldownTail[j]] = [cooldownTail[j], cooldownTail[i]];
  }
  const order = [...arr, ...cooldownTail];

  const nextHistory = [
    ...order.map((c) => c.slug),
    ...history,
  ]
    .filter((slug, idx, all) => all.indexOf(slug) === idx)
    .slice(0, historySize);

  return { order, nextHistory };
}

/** Persiste a janela atualizada (best effort). */
export function commitHistory(history: string[], storage?: Storage | null) {
  writeHistory(history.slice(0, DEFAULT_HISTORY_SIZE * 2), storage);
}

export const __testables = { readHistory, writeHistory };

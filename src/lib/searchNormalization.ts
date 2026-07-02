/**
 * Search Normalization — camada única usada em /buscar e /categoria.
 *
 * Responsabilidades:
 *  - Normalizar texto (remover acentos, hífens, lowercase) — `normalizeSearchText`
 *  - Tokenizar removendo stop-words PT-BR — delega para `sanitizeSearchTokens`
 *  - Expandir sinônimos de termos curtos críticos (baba, diarista, freelance, construcao...)
 *  - Construir um "blob" pesquisável consistente para um provider
 *  - Calcular um score textual 0..1 + decidir se a query bate no provider
 *
 * Importante: NÃO interpreta termos curtos (≤3 letras sem dicionário) como cidade —
 * isso é responsabilidade do GeoEngine. Aqui tratamos sempre como termo de serviço.
 */
import { sanitizeSearchTokens } from '@/lib/searchSanitizer';

// Mapa central de equivalências/sinônimos. Editar AQUI propaga para todas as buscas.
export const SEARCH_TERM_EQUIVALENTS: Record<string, string[]> = {
  // Cuidado infantil
  baba: ['baba', 'babá', 'nanny', 'cuidadora', 'cuidador', 'crianca', 'criança', 'infantil'],
  // Limpeza / domésticos
  diarista: ['diarista', 'faxina', 'faxineira', 'domestica', 'doméstica', 'limpeza'],
  faxina: ['diarista', 'faxina', 'faxineira', 'limpeza'],
  // Free lance
  freelance: ['freelance', 'freelancer', 'free lance', 'autonomo', 'autônomo'],
  // Construção civil — termos curtos podem ser confundidos com locais
  pedreiro: ['pedreiro', 'alvenaria', 'construcao', 'construção', 'reforma'],
  construcao: ['construcao', 'construção', 'pedreiro', 'alvenaria', 'reforma', 'obra'],
  obra: ['obra', 'construcao', 'reforma', 'pedreiro'],
  reforma: ['reforma', 'construcao', 'pedreiro', 'pintor'],
  // Outros úteis
  eletricista: ['eletricista', 'eletrica', 'elétrica', 'instalacao eletrica'],
  encanador: ['encanador', 'hidraulica', 'hidráulica', 'vazamento', 'bombeiro hidraulico'],
};

/**
 * Normalização canônica para qualquer texto pesquisável.
 * Mantida estável para que tokens combinem com o blob.
 */
export function normalizeSearchText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Expande a query do usuário em uma lista de termos normalizados, incluindo sinônimos.
 * - Trata "free lance" como "freelance"/"freelancer"
 * - Aplica sinônimos para termos curtos críticos
 */
export function expandSearchTerms(rawQuery: string): string[] {
  if (!rawQuery) return [];

  const normalizedRaw = normalizeSearchText(rawQuery);
  const baseTerms = sanitizeSearchTokens(rawQuery);
  const expanded = new Set<string>(baseTerms.map(normalizeSearchText).filter(Boolean));

  // "free lance" → freelance/freelancer
  if (normalizedRaw.includes('free lance') || normalizedRaw.includes('freelance')) {
    SEARCH_TERM_EQUIVALENTS.freelance.forEach((t) => expanded.add(normalizeSearchText(t)));
  }

  for (const term of baseTerms) {
    const key = normalizeSearchText(term);
    const aliases = SEARCH_TERM_EQUIVALENTS[key];
    if (aliases) aliases.forEach((alias) => expanded.add(normalizeSearchText(alias)));
  }

  return Array.from(expanded).filter(Boolean);
}

/**
 * Constrói o blob pesquisável de um provider.
 * Inclui slug + tokens de categoria/serviços para evitar interpretações erradas.
 */
export function buildProviderSearchBlob(p: {
  name?: string;
  category?: string;
  categorySlug?: string;
  description?: string;
  businessName?: string;
  city?: string;
  neighborhood?: string;
  state?: string;
  _searchableServices?: string;
  [key: string]: any;
}): string {
  return normalizeSearchText(
    [
      p.name,
      p.category,
      p.categorySlug,
      p.description,
      p.businessName || '',
      p.city,
      p.neighborhood,
      p.state,
      (p as any)._searchableServices || '',
    ].join(' ')
  );
}

const WORD_BOUNDARY_SAFE = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function hasSearchTermMatch(blob: string, term: string): boolean {
  if (!blob || !term) return false;

  const normalizedBlob = normalizeSearchText(blob);
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) return false;

  if (normalizedTerm.includes(' ')) {
    return normalizedBlob.includes(normalizedTerm);
  }

  const matcher = new RegExp(`(^|\\s)${WORD_BOUNDARY_SAFE(normalizedTerm)}(?=\\s|$)`, 'i');
  return matcher.test(normalizedBlob);
}

/**
 * Score textual 0..1 — quantos termos da query batem no blob.
 * Bônus pequeno se TODOS os termos baterem.
 */
export function computeTextRelevanceScore(blob: string, terms: string[]): number {
  if (!terms.length) return 0;
  let matched = 0;
  for (const term of terms) {
    if (term && hasSearchTermMatch(blob, term)) matched++;
  }
  const base = matched / terms.length;
  // Bônus de 10% para match completo (ajuda no desempate texto vs distância).
  return matched === terms.length ? Math.min(1, base + 0.1) : base;
}

export interface ProviderTextMatch {
  matched: boolean;
  score: number;
  matchedCount: number;
  termCount: number;
  strongMatch: boolean;
}

/**
 * Decide se um provider passa no filtro textual e devolve o score.
 * - 1 termo: precisa bater
 * - 2+ termos: pelo menos 50% precisam bater
 */
export function evaluateTextMatch(provider: Parameters<typeof buildProviderSearchBlob>[0], terms: string[]): ProviderTextMatch {
  if (!terms.length) {
    return { matched: true, score: 0, matchedCount: 0, termCount: 0, strongMatch: false };
  }
  const blob = buildProviderSearchBlob(provider);
  let matched = 0;
  for (const term of terms) {
    if (term && hasSearchTermMatch(blob, term)) matched++;
  }
  const threshold = terms.length === 1 ? 1 : Math.ceil(terms.length * 0.5);
  const score = computeTextRelevanceScore(blob, terms);
  return {
    matched: matched >= threshold,
    score,
    matchedCount: matched,
    termCount: terms.length,
    strongMatch: matched === terms.length,
  };
}

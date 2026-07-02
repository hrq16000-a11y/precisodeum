/**
 * serviceQualityLinter — Filtro semântico anti-leilão + score de excelência.
 *
 * Mantém o backend (`service_description_first_forbidden_term` +
 * `enforce_service_city_coherence`) como fonte de verdade. Esta camada é UX
 * preventiva: educa o prestador EM TEMPO REAL, sugere reescrita técnica,
 * calcula um Score 0–100 ("Potencial de Destaque no Google") e bloqueia o
 * envio quando o número de termos de leilão excede o limite.
 *
 * Score (total 100):
 *   - Cidade validada (catálogo IBGE) ............. +20
 *   - Descrição técnica (>= 300 caracteres) ....... +30
 *   - Palavras-chave da categoria ................. +15
 *   - Foto original detectada ..................... +25
 *   - Ausência de termos proibidos ................ +10
 */

import { detectCategoryKeywords } from './categoryKeywords';

export interface ForbiddenTermHit {
  term: string;
  index: number;
  suggestion: string;
}

/**
 * Limite tolerado de termos "leilão" antes do bloqueio de envio.
 * O linter ainda EXIBE o aviso para qualquer ocorrência (>= 1) — esta
 * constante apenas decide quando o save é bloqueado de fato.
 */
export const LEILAO_BLOCK_THRESHOLD = 3;

/**
 * Mapa termo → sugestão técnica.
 * Inclui termos compostos (multi-word) cuja regex usa lookarounds para
 * limites de palavra que aceitam acento/UTF-8.
 */
export const FORBIDDEN_TERMS: Record<string, string> = {
  // Termos simples
  barato: 'Ofereço excelente custo-benefício com foco em qualidade técnica.',
  'leilão': 'Negociação direta e transparente com o cliente.',
  leilao: 'Negociação direta e transparente com o cliente.',
  desconto: 'Condições especiais para projetos completos.',
  'orçamento': 'Solicite uma avaliação técnica para um projeto personalizado.',
  orcamento: 'Solicite uma avaliação técnica para um projeto personalizado.',
  'promoção': 'Pacotes com condições especiais.',
  promocao: 'Pacotes com condições especiais.',
  // Termos compostos
  'preço imbatível': 'Avaliação técnica detalhada para entregar o melhor projeto.',
  'preco imbativel': 'Avaliação técnica detalhada para entregar o melhor projeto.',
  'imbatível': 'Atendimento técnico de excelência.',
  imbativel: 'Atendimento técnico de excelência.',
  'cobrimos oferta': 'Avaliação personalizada de acordo com o escopo do projeto.',
  'cobrimos qualquer oferta': 'Avaliação personalizada de acordo com o escopo do projeto.',
  'preço baixo': 'Investimento justo proporcional à qualidade técnica.',
  'preco baixo': 'Investimento justo proporcional à qualidade técnica.',
  'mais barato': 'Excelente custo-benefício com qualidade comprovada.',
};

/**
 * Escapa um termo para uso seguro em RegExp.
 */
function escapeRegex(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Constrói uma RegExp tolerante a acento/UTF-8 que detecta o termo como
 * "palavra inteira" — funciona para termos simples ("barato") e compostos
 * ("preço imbatível"). Usa lookarounds com classe Unicode.
 */
function buildTermRegex(term: string, flags = 'i'): RegExp {
  const escaped = escapeRegex(term);
  // Boundary que respeita letras com acento
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, flags + 'u');
}

export function lintServiceDescription(text: string): ForbiddenTermHit[] {
  if (!text) return [];
  const hits: ForbiddenTermHit[] = [];
  for (const [term, suggestion] of Object.entries(FORBIDDEN_TERMS)) {
    const re = buildTermRegex(term, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      hits.push({ term, index: m.index, suggestion });
      // Avança para evitar loop infinito em match de comprimento zero
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

/**
 * Indica se o número de hits excede o limite tolerado e o save deve ser
 * bloqueado. UI ainda mostra alerta para qualquer hit > 0.
 */
export function shouldBlockByLeilao(hits: ForbiddenTermHit[]): boolean {
  return hits.length > LEILAO_BLOCK_THRESHOLD;
}

/**
 * Reescreve a descrição substituindo TODOS os termos proibidos pelas
 * sugestões técnicas correspondentes (1 clique = anúncio limpo).
 * Cada sugestão é incluída no máximo uma vez.
 */
export function rewriteWithQuality(text: string): string {
  if (!text) return '';
  let next = text;
  const appendedSuggestions = new Set<string>();
  for (const [term, suggestion] of Object.entries(FORBIDDEN_TERMS)) {
    const re = buildTermRegex(term, 'gi');
    if (re.test(next)) {
      next = next.replace(buildTermRegex(term, 'gi'), '').replace(/\s{2,}/g, ' ').trim();
      if (!appendedSuggestions.has(suggestion)) {
        next = `${next} ${suggestion}`.trim();
        appendedSuggestions.add(suggestion);
      }
    }
  }
  return next.replace(/\s{2,}/g, ' ').trim();
}

/** Score 0–100 do anúncio. */
export interface AdScoreInput {
  description: string;
  hasOriginalPhoto: boolean;
  cityValidated: boolean;
  /** Slugs das categorias selecionadas — alimenta o critério de keywords. */
  categorySlugs?: ReadonlyArray<string | null | undefined>;
  /** @deprecated mantido para compat com chamadas legadas; não pontua. */
  hasPrice?: boolean;
  /** @deprecated substituído pelo critério de palavras-chave. */
  hasCategory?: boolean;
}

export interface AdScoreResult {
  score: number; // 0..100
  breakdown: Array<{ key: string; label: string; value: number; reached: boolean; detail?: string }>;
  isPadrãoOuro: boolean;
  /** Hits detectados na descrição (para auditoria). */
  forbiddenHits: ForbiddenTermHit[];
  /** Palavras-chave de categoria detectadas. */
  matchedKeywords: string[];
}

const DESCRIPTION_TARGET_LEN = 300;
const KEYWORDS_TARGET_RATIO = 0.3; // 30% das keywords da categoria já dão a pontuação cheia

export function computeAdScore(input: AdScoreInput): AdScoreResult {
  const description = input.description || '';
  const length = description.trim().length;
  const forbiddenHits = lintServiceDescription(description);
  const noForbidden = forbiddenHits.length === 0;
  const { matched, total } = detectCategoryKeywords(description, input.categorySlugs || []);
  const keywordsReached = total > 0
    ? matched.length >= Math.max(1, Math.ceil(total * KEYWORDS_TARGET_RATIO))
    : false;

  const breakdown = [
    { key: 'city',         label: 'Cidade validada (catálogo IBGE)',          value: 20, reached: !!input.cityValidated },
    { key: 'description',  label: `Descrição técnica (${DESCRIPTION_TARGET_LEN}+ caracteres)`, value: 30, reached: length >= DESCRIPTION_TARGET_LEN, detail: `${length}/${DESCRIPTION_TARGET_LEN}` },
    { key: 'keywords',     label: 'Palavras-chave da categoria',              value: 15, reached: keywordsReached, detail: total > 0 ? `${matched.length}/${total}` : 'sem mapping' },
    { key: 'photo',        label: 'Foto original do serviço',                 value: 25, reached: !!input.hasOriginalPhoto },
    { key: 'noForbidden',  label: 'Sem termos de leilão na descrição',        value: 10, reached: noForbidden },
  ];

  const score = breakdown.reduce((acc, b) => acc + (b.reached ? b.value : 0), 0);
  return {
    score,
    breakdown,
    isPadrãoOuro: score >= 100,
    forbiddenHits,
    matchedKeywords: matched,
  };
}

/**
 * Sanitiza texto colado removendo prefixos legados de área de serviço.
 */
export function sanitizePastedCity(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/^\s*(em\s+)?toda\s+/i, '')
    .replace(/^\s*(em\s+)?todo\s+/i, '')
    .replace(/^\s*atendemos\s+em\s+/i, '')
    .replace(/^\s*atendo\s+em\s+/i, '')
    .trim();
}

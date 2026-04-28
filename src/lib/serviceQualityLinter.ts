/**
 * serviceQualityLinter — Filtro semântico anti-leilão.
 *
 * Identifica termos proibidos (linguagem de leilão / desvalorização) na
 * descrição do anúncio e sugere substituições focadas em valorização técnica.
 *
 * O backend possui o mesmo linter via `service_description_first_forbidden_term`
 * — esta camada client é apenas UX preventiva. A blindagem real é o trigger
 * `enforce_service_city_coherence` que rejeita com HTTP 400.
 */

export interface ForbiddenTermHit {
  term: string;
  index: number;
  suggestion: string;
}

export const FORBIDDEN_TERMS: Record<string, string> = {
  barato: 'Ofereço excelente custo-benefício com foco em qualidade técnica.',
  'leilão': 'Negociação direta e transparente com o cliente.',
  leilao: 'Negociação direta e transparente com o cliente.',
  desconto: 'Condições especiais para projetos completos.',
  'orçamento': 'Atendimento personalizado para cada demanda.',
  orcamento: 'Atendimento personalizado para cada demanda.',
  'promoção': 'Pacotes com condições especiais.',
  promocao: 'Pacotes com condições especiais.',
};

export function lintServiceDescription(text: string): ForbiddenTermHit[] {
  if (!text) return [];
  const hits: ForbiddenTermHit[] = [];
  const lower = text.toLowerCase();
  for (const [term, suggestion] of Object.entries(FORBIDDEN_TERMS)) {
    const re = new RegExp(`\\b${term}\\b`, 'i');
    const m = re.exec(lower);
    if (m && m.index >= 0) {
      hits.push({ term, index: m.index, suggestion });
    }
  }
  // Ordena por posição
  return hits.sort((a, b) => a.index - b.index);
}

/** Score 0–100 do anúncio. */
export interface AdScoreInput {
  description: string;
  hasOriginalPhoto: boolean;
  cityValidated: boolean;
  hasPrice: boolean;
  hasCategory: boolean;
}

export interface AdScoreResult {
  score: number; // 0..100
  breakdown: Array<{ label: string; value: number; reached: boolean }>;
  isPadrãoOuro: boolean;
}

export function computeAdScore(input: AdScoreInput): AdScoreResult {
  const breakdown = [
    { label: 'Descrição técnica (200+ caracteres)', value: 30, reached: (input.description?.trim().length || 0) >= 200 },
    { label: 'Foto original do serviço', value: 25, reached: !!input.hasOriginalPhoto },
    { label: 'Cidade validada (catálogo IBGE)', value: 20, reached: !!input.cityValidated },
    { label: 'Categoria selecionada', value: 15, reached: !!input.hasCategory },
    { label: 'Valores informados', value: 10, reached: !!input.hasPrice },
  ];
  const score = breakdown.reduce((acc, b) => acc + (b.reached ? b.value : 0), 0);
  return { score, breakdown, isPadrãoOuro: score >= 100 };
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

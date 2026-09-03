/**
 * Sugestões determinísticas de palavras-chave locais e pautas editoriais.
 *
 * Sem IA e sem chamada externa: combinações curadas (intenção × vertical ×
 * local) que alimentam a tela /admin/otimizacao-local e as páginas
 * programáticas. Determinístico = mesmo input, mesma saída (testável).
 */

import type { ServiceVertical } from '@/lib/programmaticServices';

export type KeywordIntent = 'informacional' | 'transacional' | 'urgencia' | 'preco' | 'hiperlocal';

export interface KeywordIdea {
  keyword: string;
  intent: KeywordIntent;
  /** Prioridade heurística 1..100 (volume esperado × facilidade). */
  priority: number;
}

export interface ContentIdea {
  title: string;
  angle: string;
  intent: KeywordIntent;
}

const INTENT_WEIGHT: Record<KeywordIntent, number> = {
  transacional: 95,
  urgencia: 85,
  preco: 80,
  hiperlocal: 70,
  informacional: 55,
};

function clampPriority(base: number, index: number): number {
  return Math.max(10, Math.min(100, base - index * 3));
}

export interface LocalKeywordInput {
  vertical: Pick<ServiceVertical, 'slug' | 'label' | 'inlineLabel'> & { keywordSeeds: string[] };
  cityLabel: string;
  state?: string | null;
  neighborhoodLabels?: string[];
  providerCount?: number;
}

/** Lista de palavras-chave locais ordenada por prioridade. */
export function buildLocalKeywords(input: LocalKeywordInput): KeywordIdea[] {
  const { vertical, cityLabel, state, neighborhoodLabels = [] } = input;
  const inline = vertical.inlineLabel;
  const uf = (state || '').trim();
  const city = cityLabel.trim();

  const out: KeywordIdea[] = [];
  const push = (keyword: string, intent: KeywordIntent, index: number) => {
    const clean = keyword.replace(/\s+/g, ' ').trim();
    if (!clean || out.some((k) => k.keyword === clean)) return;
    out.push({ keyword: clean, intent, priority: clampPriority(INTENT_WEIGHT[intent], index) });
  };

  vertical.keywordSeeds.forEach((seed, i) => push(`${seed} ${city}`, 'transacional', i));
  push(`${inline} em ${city}`, 'transacional', 0);
  if (uf) push(`${inline} ${city} ${uf}`, 'transacional', 1);
  push(`${inline} perto de mim ${city}`, 'transacional', 2);

  push(`${inline} urgente ${city}`, 'urgencia', 0);
  push(`${inline} 24 horas ${city}`, 'urgencia', 1);
  push(`${inline} hoje ${city}`, 'urgencia', 2);
  push(`${inline} fim de semana ${city}`, 'urgencia', 3);

  push(`quanto custa ${inline} em ${city}`, 'preco', 0);
  push(`preço de ${inline} ${city}`, 'preco', 1);
  push(`orçamento de ${inline} ${city}`, 'preco', 2);
  push(`${inline} barato ${city}`, 'preco', 3);

  neighborhoodLabels.slice(0, 12).forEach((hood, i) => {
    push(`${inline} ${hood} ${city}`, 'hiperlocal', i);
  });

  push(`como escolher ${inline} em ${city}`, 'informacional', 0);
  push(`${inline} de confiança ${city}`, 'informacional', 1);
  push(`avaliações de ${inline} ${city}`, 'informacional', 2);

  return out.sort((a, b) => b.priority - a.priority || a.keyword.localeCompare(b.keyword));
}

/** Pautas de conteúdo editorial para a landing local. */
export function buildContentIdeas(input: LocalKeywordInput): ContentIdea[] {
  const { vertical, cityLabel, neighborhoodLabels = [], providerCount = 0 } = input;
  const inline = vertical.inlineLabel;
  const city = cityLabel.trim();
  const hoods = neighborhoodLabels.slice(0, 4);

  const ideas: ContentIdea[] = [
    {
      title: `Quanto custa ${inline} em ${city} em 2026`,
      angle: `Tabela de faixas de preço por tipo de serviço, o que entra e o que não entra no orçamento, e como comparar propostas sem leilão de preço.`,
      intent: 'preco',
    },
    {
      title: `Checklist antes de contratar ${inline} em ${city}`,
      angle: `Documentos, garantia combinada, prazo, material incluso e forma de pagamento — reforça confiança e reduz lead frio.`,
      intent: 'informacional',
    },
    {
      title: `${vertical.label} de emergência em ${city}: o que fazer primeiro`,
      angle: `Passo a passo dos 15 minutos iniciais e quando o atendimento tem de ser imediato. Captura intenção de urgência.`,
      intent: 'urgencia',
    },
  ];

  if (hoods.length) {
    ideas.push({
      title: `Onde encontrar ${inline} nos bairros de ${city}`,
      angle: `Bloco hiperlocal citando ${hoods.join(', ')} com link para cada landing de bairro — reforça a malha interna.`,
      intent: 'hiperlocal',
    });
  }

  if (providerCount > 0) {
    ideas.push({
      title: `${providerCount} profissionais de ${inline} atendendo ${city}`,
      angle: `Prova social com avaliações aprovadas, tempo de resposta e serviços mais pedidos na cidade.`,
      intent: 'transacional',
    });
  }

  return ideas;
}

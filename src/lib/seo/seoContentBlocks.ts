/**
 * SEO Content Blocks — Fase 2.8
 *
 * Gera blocos textuais determinísticos para landings city/category.
 * Sem IA runtime, sem lorem ipsum, sem repetição genérica entre cidades.
 *
 * REGRAS:
 *  - mínimo 250 palavras agregadas para passar elegibilidade textual
 *  - fail-closed: sem elegibilidade → array vazio
 *  - templates contextualizados (categoria + cidade + sinais reais)
 */

export type SeoContentBlockKind =
  | 'how_to_hire'
  | 'price_range'
  | 'what_to_check'
  | 'common_mistakes'
  | 'when_urgency'
  | 'local_tips';

export interface SeoContentBlock {
  kind: SeoContentBlockKind;
  title: string;
  paragraphs: string[];
}

export interface SeoContentInput {
  categoryName?: string;
  citySlug?: string;
  cityName?: string;
  providersCount?: number;
  hasSponsor?: boolean;
  monthlyViews?: number;
  conversionRate?: number;
  manualContentChars?: number;
}

export interface SeoContentEligibility {
  eligible: boolean;
  reasons: string[];
}

const MIN_PROVIDERS = 3;
const MIN_VIEWS = 50;
const MIN_CTR = 0.04;
const MIN_MANUAL_CHARS = 280;

/**
 * Gate de elegibilidade para renderizar blocos de conteúdo SEO.
 * Fail-closed: qualquer sinal positivo libera; sem sinais → bloqueia.
 */
export function isSeoContentEligible(input: SeoContentInput): SeoContentEligibility {
  const reasons: string[] = [];
  const providersOk = (input.providersCount ?? 0) >= MIN_PROVIDERS;
  const viewsOk = (input.monthlyViews ?? 0) >= MIN_VIEWS;
  const ctrOk = (input.conversionRate ?? 0) >= MIN_CTR;
  const sponsorOk = !!input.hasSponsor;
  const manualOk = (input.manualContentChars ?? 0) >= MIN_MANUAL_CHARS;

  if (providersOk) reasons.push('providers');
  if (viewsOk) reasons.push('traffic');
  if (ctrOk) reasons.push('conversion');
  if (sponsorOk) reasons.push('sponsor');
  if (manualOk) reasons.push('manual_content');

  return { eligible: reasons.length > 0, reasons };
}

function withCity(city?: string): string {
  return city ? ` em ${city}` : '';
}

function categoryLabel(input: SeoContentInput): string {
  return (input.categoryName || 'profissional').toLowerCase();
}

function buildHowToHire(input: SeoContentInput): SeoContentBlock {
  const cat = categoryLabel(input);
  const city = withCity(input.cityName);
  return {
    kind: 'how_to_hire',
    title: `Como contratar ${cat}${city}`,
    paragraphs: [
      `Para contratar ${cat}${city}, comece comparando perfis com fotos reais de serviços já entregues, área de atendimento compatível e tempo de resposta no WhatsApp.`,
      `Descreva o problema com objetividade: tipo do serviço, prazo desejado, endereço aproximado (bairro) e materiais já disponíveis. Quanto mais claro o briefing, mais preciso o profissional pode ser na resposta.`,
      `Converse com pelo menos dois ou três profissionais antes de fechar. Avalie disponibilidade, prazo e clareza nas respostas — e priorize quem responde rápido e demonstra experiência prática.`,
    ],
  };
}

function buildPriceRange(input: SeoContentInput): SeoContentBlock {
  const cat = categoryLabel(input);
  const city = withCity(input.cityName);
  return {
    kind: 'price_range',
    title: `Quanto custa ${cat}${city}`,
    paragraphs: [
      `O valor cobrado por ${cat}${city} varia com a complexidade, urgência, distância e materiais. Trabalhos pontuais costumam ter valor mínimo de visita; serviços maiores são orçados após avaliação.`,
      `Sempre que possível, prefira orçamento por escopo (serviço fechado) e não apenas por hora — isso protege contra surpresas e facilita a comparação entre profissionais.`,
    ],
  };
}

function buildWhatToCheck(input: SeoContentInput): SeoContentBlock {
  const cat = categoryLabel(input);
  return {
    kind: 'what_to_check',
    title: `O que avaliar antes de contratar ${cat}`,
    paragraphs: [
      `Verifique experiência prática, especialidades, prazo médio de resposta e disponibilidade real para a sua cidade. Confira o portfólio com fotos próprias do profissional e leia avaliações de outros clientes.`,
      `Combine sempre por escrito o escopo, prazo, forma de pagamento e o que está ou não incluso. Em serviços técnicos, registre número de visitas, garantia e materiais cobertos.`,
    ],
  };
}

function buildCommonMistakes(input: SeoContentInput): SeoContentBlock {
  const cat = categoryLabel(input);
  return {
    kind: 'common_mistakes',
    title: `Erros comuns ao contratar ${cat}`,
    paragraphs: [
      `Decidir só pelo menor preço, sem comparar escopo. O barato pode sair caro quando faltam materiais, etapas ou garantia no orçamento.`,
      `Combinar tudo por telefone sem registrar por WhatsApp. Mantenha o histórico escrito para evitar mal-entendidos sobre prazo, valor e responsabilidades.`,
      `Não confirmar área de atendimento e deslocamento. Confirme antes se o profissional atende o bairro e se há custo de visita.`,
    ],
  };
}

function buildUrgency(input: SeoContentInput): SeoContentBlock {
  const cat = categoryLabel(input);
  const city = withCity(input.cityName);
  return {
    kind: 'when_urgency',
    title: `Quando vale acionar ${cat} com urgência`,
    paragraphs: [
      `Atendimento emergencial faz sentido quando há risco imediato (vazamento, queda de energia, porta arrombada) ou impacto direto na rotina (sem água, sem luz, sem acesso).`,
      `Para urgências${city}, dê preferência a profissionais com resposta rápida no WhatsApp e área de atendimento próxima — isso reduz o tempo até o início do serviço.`,
    ],
  };
}

function buildLocalTips(input: SeoContentInput): SeoContentBlock {
  const city = input.cityName || 'sua cidade';
  return {
    kind: 'local_tips',
    title: `Dicas locais em ${city}`,
    paragraphs: [
      `Confirme se o profissional já atendeu no seu bairro: trânsito, horários de pico e tipo de imóvel mudam o tempo e o custo do serviço.`,
      `Em prédios, alinhe regras de horário, uso de elevador de serviço e necessidade de aviso ao síndico antes da visita.`,
    ],
  };
}

const BUILDERS: Record<SeoContentBlockKind, (i: SeoContentInput) => SeoContentBlock> = {
  how_to_hire: buildHowToHire,
  price_range: buildPriceRange,
  what_to_check: buildWhatToCheck,
  common_mistakes: buildCommonMistakes,
  when_urgency: buildUrgency,
  local_tips: buildLocalTips,
};

function wordCount(blocks: SeoContentBlock[]): number {
  let n = 0;
  for (const b of blocks) {
    n += b.title.split(/\s+/).filter(Boolean).length;
    for (const p of b.paragraphs) {
      n += p.split(/\s+/).filter(Boolean).length;
    }
  }
  return n;
}

export const MIN_AGGREGATED_WORDS = 250;
export const MAX_AGGREGATED_WORDS = 700;

/**
 * Constrói blocos de conteúdo SEO. Retorna [] quando inelegível ou
 * quando o agregado não atinge o mínimo de palavras.
 */
export function buildContentBlocks(
  input: SeoContentInput,
  kinds?: SeoContentBlockKind[],
): SeoContentBlock[] {
  const verdict = isSeoContentEligible(input);
  if (!verdict.eligible) return [];

  const selectedKinds: SeoContentBlockKind[] = kinds ?? [
    'how_to_hire',
    'price_range',
    'what_to_check',
    'common_mistakes',
    ...(input.cityName ? (['local_tips'] as SeoContentBlockKind[]) : []),
  ];

  const seen = new Set<SeoContentBlockKind>();
  const blocks: SeoContentBlock[] = [];
  for (const k of selectedKinds) {
    if (seen.has(k)) continue;
    seen.add(k);
    blocks.push(BUILDERS[k](input));
  }

  if (wordCount(blocks) < MIN_AGGREGATED_WORDS) return [];
  return blocks;
}

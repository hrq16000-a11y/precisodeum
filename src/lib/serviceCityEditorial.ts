/**
 * Conteúdo editorial diferenciado por cidade para as landings programáticas
 * /servico/{vertical}/{cidade}.
 *
 * Objetivo: evitar que todas as páginas de cidade compartilhem exatamente o
 * mesmo texto (thin/duplicate content) sem recorrer a IA. A variação é
 * determinística (hash FNV-1a do par vertical+cidade), então o mesmo par
 * sempre gera o mesmo texto — bom para cache, SSR e auditoria.
 *
 * Todos os textos são genéricos-verdadeiros: falam de clima/perfil regional
 * amplo e do que já existe na base (nº de profissionais, bairros atendidos).
 * Nada de afirmação inventada sobre a cidade.
 */

export interface CityEditorialBlock {
  title: string;
  body: string;
}

export interface CityEditorialInput {
  verticalSlug: string;
  verticalLabel: string;
  inlineLabel: string;
  citySlug: string;
  cityLabel: string;
  state?: string | null;
  providerCount?: number;
  neighborhoodLabels?: string[];
}

/** Hash estável 32-bit (FNV-1a) — mesma abordagem usada no experiment engine. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const pick = <T,>(list: T[], seed: number, offset = 0): T => list[(seed + offset) % list.length];

/** Agrupamento climático/regional amplo por UF — usado para contexto honesto. */
const REGION_NOTE: Record<string, string> = {
  N: 'clima quente e úmido boa parte do ano, com chuvas fortes concentradas em alguns meses',
  NE: 'calor constante, maresia em cidades litorâneas e períodos secos bem definidos',
  CO: 'estações secas longas seguidas de chuvas intensas, o que exige atenção com dilatação e infiltração',
  SE: 'variação grande entre verão chuvoso e inverno seco, com umidade alta em áreas de serra e litoral',
  S: 'invernos frios e úmidos e verões chuvosos, cenário clássico para mofo, trincas e desgaste de acabamento',
};

const UF_REGION: Record<string, keyof typeof REGION_NOTE> = {
  AC: 'N', AM: 'N', AP: 'N', PA: 'N', RO: 'N', RR: 'N', TO: 'N',
  AL: 'NE', BA: 'NE', CE: 'NE', MA: 'NE', PB: 'NE', PE: 'NE', PI: 'NE', RN: 'NE', SE: 'NE',
  DF: 'CO', GO: 'CO', MS: 'CO', MT: 'CO',
  ES: 'SE', MG: 'SE', RJ: 'SE', SP: 'SE',
  PR: 'S', RS: 'S', SC: 'S',
};

const DEMAND_ANGLES = [
  (v: string, c: string) => `A procura por ${v} em ${c} costuma se concentrar em manutenção preventiva e em serviços que não podem esperar.`,
  (v: string, c: string) => `Em ${c}, boa parte dos pedidos de ${v} chega de moradores que já tentaram resolver sozinhos e precisam de um acabamento profissional.`,
  (v: string, c: string) => `Quem busca ${v} em ${c} normalmente compara dois ou três orçamentos antes de fechar — vale alinhar escopo e prazo logo no primeiro contato.`,
  (v: string, c: string) => `Os chamados de ${v} em ${c} se dividem entre imóveis em reforma e manutenção do dia a dia em casas e apartamentos já ocupados.`,
];

const TIMING_ANGLES = [
  'Serviços agendados com alguns dias de antecedência costumam ter preço melhor do que atendimentos de urgência.',
  'Finais de semana e feriados costumam ter menos disponibilidade — se o serviço puder esperar, agende em dia útil.',
  'Combinar horário fora do pico de trânsito ajuda o profissional a cumprir o prazo e reduz custo de deslocamento.',
  'Serviços agrupados no mesmo dia (várias pendências de uma vez) saem mais em conta do que visitas separadas.',
];

const CHECK_ANGLES = [
  'Antes de fechar, confirme o que está incluso: mão de obra, material, deslocamento e limpeza depois do serviço.',
  'Peça o orçamento por escrito, mesmo que seja por mensagem — evita divergência sobre escopo depois.',
  'Alinhe forma de pagamento e prazo de garantia da mão de obra antes do início do trabalho.',
  'Registre com fotos como o ambiente estava antes: ajuda na conferência do resultado final.',
];

/**
 * Gera 2 blocos editoriais únicos por cidade/vertical, com contexto regional e
 * dados reais da base (profissionais e bairros atendidos).
 */
export function buildCityEditorial(input: CityEditorialInput): CityEditorialBlock[] {
  const { verticalLabel, inlineLabel, cityLabel, citySlug, verticalSlug } = input;
  if (!cityLabel || !citySlug) return [];

  const seed = hash(`${verticalSlug}:${citySlug}`);
  const uf = (input.state || '').toUpperCase();
  const regionNote = REGION_NOTE[UF_REGION[uf] ?? ''] || '';
  const count = input.providerCount ?? 0;
  const hoods = (input.neighborhoodLabels || []).filter(Boolean).slice(0, 6);

  const demand = pick(DEMAND_ANGLES, seed)(inlineLabel, cityLabel);
  const timing = pick(TIMING_ANGLES, seed, 1);
  const check = pick(CHECK_ANGLES, seed, 2);

  const countSentence = count > 0
    ? `Hoje há ${count} ${count === 1 ? 'profissional cadastrado' : 'profissionais cadastrados'} atendendo ${cityLabel}${uf ? ` (${uf})` : ''} nesta categoria.`
    : `A lista de profissionais em ${cityLabel} está em formação — o contato direto agiliza o atendimento.`;

  const hoodSentence = hoods.length
    ? ` A cobertura declarada inclui bairros como ${hoods.slice(0, -1).join(', ')}${hoods.length > 1 ? ' e ' : ''}${hoods[hoods.length - 1]}.`
    : '';

  const climateSentence = regionNote
    ? ` Como a região tem ${regionNote}, vale descrever bem o problema e o histórico do imóvel na hora do orçamento.`
    : '';

  return [
    {
      title: `${verticalLabel} em ${cityLabel}: como é a demanda local`,
      body: `${demand} ${countSentence}${hoodSentence}${climateSentence}`.trim(),
    },
    {
      title: `Dicas para contratar ${inlineLabel} em ${cityLabel}`,
      body: `${timing} ${check} Combine tudo direto com o profissional: a plataforma não cobra comissão nem intermedeia o pagamento.`,
    },
  ];
}

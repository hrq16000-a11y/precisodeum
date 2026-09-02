/**
 * Registro de verticais programáticas de serviço.
 *
 * Fonte única do conteúdo editorial, metadados e malha de links das landings
 * /servico/{slug} e /servico/{slug}/{cidade[-bairro]}. A vertical
 * "marido-de-aluguel" mantém as rotas legadas (/marido-de-aluguel-{cidade})
 * já indexadas — o campo `pathStyle` controla isso.
 *
 * Sem IA: textos curados por vertical, reaproveitados no FAQPage JSON-LD,
 * nos metadados e nos blocos de conteúdo (anti thin content).
 */

import {
  HANDYMAN_PRICES,
  HANDYMAN_SLUG,
  HANDYMAN_STEPS,
  HANDYMAN_TASKS,
  buildHandymanFaq,
  handymanCityPath,
  handymanNeighborhoodPath,
} from './handymanServiceContent';

export interface ServiceTask { title: string; description: string; icon: string }
export interface ServiceStep { title: string; description: string }
export interface ServicePriceRow { service: string; range: string; note: string }
export interface ServiceFaq { question: string; answer: string }

export interface ServiceVertical {
  /** Slug da landing e da categoria correspondente em `categories`. */
  slug: string;
  label: string;
  /** Rótulo em minúsculo usado dentro das frases ("um pintor em Curitiba"). */
  inlineLabel: string;
  /** Artigo usado antes do rótulo ("um" / "uma"). */
  article: 'um' | 'uma';
  icon: string;
  /** Slugs de categoria aceitos na listagem (permite variações). */
  categorySlugs: string[];
  /** 'legacy' = /marido-de-aluguel-curitiba ; 'nested' = /servico/pintor/curitiba */
  pathStyle: 'legacy' | 'nested';
  intro: string;
  whatItIs: string;
  tasks: ServiceTask[];
  steps: ServiceStep[];
  prices: ServicePriceRow[];
  priceRange: { low: number; high: number };
  buildFaq: (localLabel?: string | null) => ServiceFaq[];
  /** Palavras-chave extras aplicadas nos metadados locais. */
  keywordSeeds: string[];
}

const COMMON_STEPS: ServiceStep[] = HANDYMAN_STEPS;

function priceFaqAnswer(range: string) {
  return `A maior parte dos profissionais trabalha com orçamento por serviço ou por diária. As faixas praticadas ficam em torno de ${range}. O valor final depende do tamanho do trabalho, do material e do deslocamento — combine sempre direto com o profissional antes de começar.`;
}

const PINTOR: ServiceVertical = {
  slug: 'pintor',
  label: 'Pintor',
  inlineLabel: 'pintor',
  article: 'um',
  icon: 'PaintRoller',
  categorySlugs: ['pintor'],
  pathStyle: 'nested',
  intro:
    'Pintura residencial, comercial e predial com acabamento profissional: preparação de parede, massa corrida, textura, esmalte e verniz.',
  whatItIs:
    'O pintor profissional cuida de todo o processo: proteção do ambiente, correção de trincas e imperfeições, aplicação de massa e selador, demão de tinta e acabamento. Um serviço bem preparado dura anos a mais do que uma pintura feita direto na parede.',
  tasks: [
    { icon: 'PaintRoller', title: 'Pintura interna', description: 'Salas, quartos, corredores e tetos com preparação de parede, massa corrida e duas demãos.' },
    { icon: 'Home', title: 'Pintura externa e fachada', description: 'Tinta acrílica, impermeabilizante e correção de infiltração em muros e fachadas.' },
    { icon: 'Layers', title: 'Textura e efeitos', description: 'Grafiato, textura rolada, cimento queimado e efeitos decorativos.' },
    { icon: 'Hammer', title: 'Preparação e reparos', description: 'Lixamento, massa corrida, correção de trincas, selador e retirada de mofo.' },
    { icon: 'DoorOpen', title: 'Esquadrias e madeira', description: 'Portas, portões, grades e móveis com esmalte sintético ou verniz.' },
    { icon: 'Building2', title: 'Pintura comercial', description: 'Lojas, escritórios e áreas comuns de condomínio, com trabalho fora do horário comercial.' },
  ],
  steps: COMMON_STEPS,
  prices: [
    { service: 'Pintura de parede (m²) — mão de obra', range: 'R$ 12 a R$ 30', note: 'Sem material; varia com número de demãos e altura.' },
    { service: 'Quarto padrão (até 12 m²)', range: 'R$ 350 a R$ 900', note: 'Inclui preparação leve e duas demãos.' },
    { service: 'Apartamento 2 quartos completo', range: 'R$ 2.500 a R$ 6.000', note: 'Depende do estado das paredes e do tipo de tinta.' },
    { service: 'Textura / grafiato (m²)', range: 'R$ 25 a R$ 60', note: 'Acabamentos decorativos exigem mais tempo de aplicação.' },
    { service: 'Fachada e muro (m²)', range: 'R$ 18 a R$ 45', note: 'Pode incluir andaime, impermeabilizante e correção de trinca.' },
    { service: 'Diária de pintor', range: 'R$ 200 a R$ 400', note: 'Comum em serviços de retoque e pequenos ambientes.' },
  ],
  priceRange: { low: 200, high: 6000 },
  keywordSeeds: ['pintor', 'pintura residencial', 'pintor de parede', 'pintura de apartamento', 'pintor predial'],
  buildFaq: (localLabel) => {
    const local = localLabel ? ` em ${localLabel}` : '';
    return [
      { question: `O que faz um pintor profissional${local}?`, answer: 'Prepara a superfície (lixamento, massa corrida, correção de trincas e selador), protege móveis e piso, aplica as demãos de tinta e faz o acabamento em rodapés, batentes e esquadrias. Também trabalha com textura, grafiato, esmalte e verniz.' },
      { question: `Quanto custa contratar um pintor${local}?`, answer: priceFaqAnswer('R$ 12 a R$ 30 por m² de mão de obra, ou R$ 200 a R$ 400 a diária') },
      { question: 'A tinta está inclusa no orçamento?', answer: 'Na maioria dos casos não. O padrão é cobrar a mão de obra e o cliente comprar a tinta e o material, ou o profissional comprar e repassar com nota. Peça sempre o orçamento discriminado (mão de obra x material).' },
      { question: 'Quantas demãos de tinta são necessárias?', answer: 'O padrão é duas demãos sobre parede preparada. Cores fortes, mudança de cor escura para clara ou parede sem selador podem exigir três demãos — isso deve estar claro no orçamento.' },
      { question: 'Quanto tempo demora pintar um apartamento?', answer: 'Um apartamento de dois quartos vazio costuma levar de 4 a 8 dias úteis com um profissional, considerando preparação, secagem entre demãos e acabamento. Ambientes mobiliados levam mais tempo pela proteção necessária.' },
      { question: 'Preciso sair de casa durante a pintura?', answer: 'Não necessariamente. Tintas acrílicas à base de água têm odor baixo e permitem permanecer no imóvel. Já esmalte sintético e verniz exigem ventilação e costumam ser feitos em ambientes desocupados.' },
      { question: 'A plataforma cobra comissão?', answer: 'Não. O Preciso de um conecta você diretamente ao profissional. Preço, prazo e forma de pagamento são combinados entre as partes, sem taxa da plataforma.' },
    ];
  },
};

const ELETRICISTA: ServiceVertical = {
  slug: 'eletricista',
  label: 'Eletricista',
  inlineLabel: 'eletricista',
  article: 'um',
  icon: 'Zap',
  categorySlugs: ['eletricista', 'eletricista-residencial'],
  pathStyle: 'nested',
  intro:
    'Instalação e manutenção elétrica residencial e comercial: quadro de distribuição, tomadas, chuveiro, iluminação, curto-circuito e aterramento.',
  whatItIs:
    'O eletricista faz instalação, manutenção e diagnóstico de sistemas elétricos com segurança e dentro da norma NBR 5410. Vai de trocas simples de tomada e chuveiro até troca de quadro, correção de sobrecarga e passagem de nova fiação.',
  tasks: [
    { icon: 'Zap', title: 'Tomadas e interruptores', description: 'Troca, instalação de novos pontos, tomadas USB e reparo de mau contato.' },
    { icon: 'ShowerHead', title: 'Chuveiro e aquecedor', description: 'Instalação e troca de chuveiro elétrico, disjuntor adequado e revisão de fiação.' },
    { icon: 'Lightbulb', title: 'Iluminação', description: 'Luminárias, spots, trilhos, fita de LED, sensor de presença e lustres.' },
    { icon: 'ShieldCheck', title: 'Quadro e disjuntores', description: 'Troca de quadro, DR, DPS, balanceamento de fases e correção de sobrecarga.' },
    { icon: 'Search', title: 'Diagnóstico de falhas', description: 'Curto-circuito, disjuntor desarmando, oscilação de energia e fuga de corrente.' },
    { icon: 'Building2', title: 'Elétrica comercial', description: 'Lojas, escritórios e condomínios: pontos novos, quadros e manutenção preventiva.' },
  ],
  steps: COMMON_STEPS,
  prices: [
    { service: 'Visita técnica / diagnóstico', range: 'R$ 90 a R$ 180', note: 'Muitos abatem o valor do serviço aprovado.' },
    { service: 'Troca de tomada ou interruptor', range: 'R$ 60 a R$ 150', note: 'Por ponto; valor cai quando são vários na mesma visita.' },
    { service: 'Instalação de chuveiro elétrico', range: 'R$ 100 a R$ 250', note: 'Pode variar se precisar trocar fiação ou disjuntor.' },
    { service: 'Instalação de luminária / lustre', range: 'R$ 80 a R$ 250', note: 'Depende do peso, do pé-direito e do tipo de fixação.' },
    { service: 'Troca de quadro de distribuição', range: 'R$ 600 a R$ 2.000', note: 'Inclui disjuntores, DR e DPS conforme a carga do imóvel.' },
    { service: 'Diária de eletricista', range: 'R$ 300 a R$ 600', note: 'Indicada para reformas e vários pontos no mesmo dia.' },
  ],
  priceRange: { low: 60, high: 2000 },
  keywordSeeds: ['eletricista', 'eletricista residencial', 'eletricista 24 horas', 'instalação elétrica', 'troca de disjuntor'],
  buildFaq: (localLabel) => {
    const local = localLabel ? ` em ${localLabel}` : '';
    return [
      { question: `O que faz um eletricista${local}?`, answer: 'Instala e faz manutenção de pontos elétricos: tomadas, interruptores, iluminação, chuveiro, quadro de distribuição, disjuntores, DR e aterramento. Também diagnostica curto-circuito, sobrecarga e oscilação de energia.' },
      { question: `Quanto custa chamar um eletricista${local}?`, answer: priceFaqAnswer('R$ 60 a R$ 250 por ponto/serviço simples, ou R$ 300 a R$ 600 a diária') },
      { question: 'O disjuntor desarma sozinho — o que pode ser?', answer: 'Geralmente é sobrecarga no circuito, curto-circuito, fuga de corrente (DR atuando) ou disjuntor subdimensionado. É um caso para diagnóstico presencial: usar um disjuntor maior sem avaliar a fiação é perigoso e pode causar incêndio.' },
      { question: 'Preciso desligar a energia da casa toda?', answer: 'Nem sempre. O profissional costuma desligar apenas o circuito envolvido no quadro. Trocas de quadro e serviços na entrada de energia exigem desligamento geral e podem precisar de agendamento com a concessionária.' },
      { question: 'Eletricista emite garantia do serviço?', answer: 'Profissionais sérios oferecem garantia de mão de obra (comumente 90 dias) e nota ou recibo. Peça isso por escrito no orçamento, junto com a lista de material aplicado.' },
      { question: 'Existe atendimento de urgência?', answer: 'Muitos profissionais atendem emergências como falta de energia parcial, cheiro de queimado e curto-circuito, com valor diferenciado fora do horário comercial. Confirme a disponibilidade direto no contato.' },
      { question: 'A plataforma cobra comissão?', answer: 'Não. Você fala direto com o profissional e negocia valor, prazo e forma de pagamento sem taxa da plataforma.' },
    ];
  },
};

const ENCANADOR: ServiceVertical = {
  slug: 'encanador',
  label: 'Encanador',
  inlineLabel: 'encanador',
  article: 'um',
  icon: 'Wrench',
  categorySlugs: ['encanador'],
  pathStyle: 'nested',
  intro:
    'Serviços hidráulicos: caça-vazamento, desentupimento, troca de torneira e registro, reparo de caixa d\u2019água e instalação de louças.',
  whatItIs:
    'O encanador resolve tudo que envolve água e esgoto no imóvel: vazamentos, entupimentos, troca de tubulação, instalação de louças e metais, caixa d\u2019água, aquecedor e pressurizador. Vazamento não tratado vira infiltração e conta de água alta.',
  tasks: [
    { icon: 'Droplets', title: 'Caça-vazamento', description: 'Localização de vazamento em parede, piso e laje com reparo pontual.' },
    { icon: 'Waves', title: 'Desentupimento', description: 'Pia, ralo, vaso sanitário, caixa de gordura e coluna de esgoto.' },
    { icon: 'Wrench', title: 'Torneiras e registros', description: 'Troca de torneira, registro, sifão, engate e reparo de misturador.' },
    { icon: 'Bath', title: 'Louças e metais', description: 'Instalação de vaso sanitário, cuba, box, chuveiro e ducha higiênica.' },
    { icon: 'Home', title: 'Caixa d\u2019água e bomba', description: 'Limpeza, troca de boia, instalação de bomba e pressurizador.' },
    { icon: 'Building2', title: 'Hidráulica em reforma', description: 'Troca de tubulação, novos pontos de água e esgoto em reforma.' },
  ],
  steps: COMMON_STEPS,
  prices: [
    { service: 'Visita técnica / diagnóstico', range: 'R$ 90 a R$ 180', note: 'Costuma ser abatida do serviço aprovado.' },
    { service: 'Desentupimento simples (pia/ralo)', range: 'R$ 120 a R$ 350', note: 'Coluna de esgoto e caixa de gordura custam mais.' },
    { service: 'Caça-vazamento', range: 'R$ 250 a R$ 700', note: 'Depende da técnica usada e da área investigada.' },
    { service: 'Troca de torneira ou registro', range: 'R$ 80 a R$ 220', note: 'Registro embutido exige quebrar e refazer acabamento.' },
    { service: 'Instalação de vaso sanitário', range: 'R$ 150 a R$ 400', note: 'Vaso com caixa acoplada e retirada do antigo inclusa.' },
    { service: 'Diária de encanador', range: 'R$ 300 a R$ 600', note: 'Indicada para reforma e vários pontos no mesmo dia.' },
  ],
  priceRange: { low: 80, high: 700 },
  keywordSeeds: ['encanador', 'desentupidora', 'caça vazamento', 'encanador 24 horas', 'reparo hidráulico'],
  buildFaq: (localLabel) => {
    const local = localLabel ? ` em ${localLabel}` : '';
    return [
      { question: `O que faz um encanador${local}?`, answer: 'Cuida da parte hidráulica do imóvel: localizar e reparar vazamentos, desentupir pia, ralo e vaso, trocar torneiras, registros e sifões, instalar louças e metais, e resolver problemas de caixa d\u2019água, bomba e pressurizador.' },
      { question: `Quanto custa chamar um encanador${local}?`, answer: priceFaqAnswer('R$ 80 a R$ 350 em serviços simples e R$ 250 a R$ 700 em caça-vazamento') },
      { question: 'Como sei que tenho um vazamento escondido?', answer: 'Sinais comuns: conta de água acima do normal, mancha de umidade ou mofo em parede, piso quente próximo à tubulação de água quente, som de água correndo com tudo fechado e queda de pressão. O teste do hidrômetro com tudo fechado ajuda a confirmar.' },
      { question: 'Preciso quebrar a parede para achar o vazamento?', answer: 'Nem sempre. Profissionais com equipamento de detecção (geofone, gás traçador ou câmera térmica) localizam o ponto exato e a quebra fica restrita àquela região, reduzindo custo de reparo do acabamento.' },
      { question: 'Vaso entupido: posso resolver sozinho?', answer: 'Entupimentos leves saem com desentupidor de borracha. Se a água volta em outros pontos da casa ou o problema se repete, o entupimento está na coluna ou na caixa de gordura — nesse caso produtos químicos podem danificar a tubulação e o serviço profissional é o caminho.' },
      { question: 'Tem atendimento de emergência?', answer: 'Muitos profissionais atendem urgências como vazamento com água escorrendo e esgoto retornando, inclusive fora do horário comercial com valor diferenciado. Confirme a disponibilidade direto no contato.' },
      { question: 'A plataforma cobra comissão?', answer: 'Não. A negociação de valor, prazo e forma de pagamento acontece direto entre você e o profissional.' },
    ];
  },
};

const MARIDO_DE_ALUGUEL: ServiceVertical = {
  slug: HANDYMAN_SLUG,
  label: 'Marido de aluguel',
  inlineLabel: 'marido de aluguel',
  article: 'um',
  icon: 'Wrench',
  categorySlugs: [HANDYMAN_SLUG],
  pathStyle: 'legacy',
  intro:
    'Pequenos reparos e manutenção geral da casa: hidráulica leve, elétrica residencial, fixação, montagem de móveis e retoques de pintura.',
  whatItIs:
    'É o profissional de manutenção geral que resolve as pendências da casa sem precisar contratar um especialista para cada tarefa.',
  tasks: HANDYMAN_TASKS,
  steps: HANDYMAN_STEPS,
  prices: HANDYMAN_PRICES,
  priceRange: { low: 70, high: 900 },
  keywordSeeds: ['marido de aluguel', 'pequenos reparos residenciais', 'montagem de móveis', 'manutenção residencial'],
  buildFaq: buildHandymanFaq,
};

export const SERVICE_VERTICALS: ServiceVertical[] = [
  MARIDO_DE_ALUGUEL,
  PINTOR,
  ELETRICISTA,
  ENCANADOR,
];

/** Verticais com rotas /servico/{slug}/... (exclui a malha legada). */
export const NESTED_SERVICE_VERTICALS = SERVICE_VERTICALS.filter((v) => v.pathStyle === 'nested');

export function getServiceVertical(slug?: string | null): ServiceVertical | null {
  if (!slug) return null;
  return SERVICE_VERTICALS.find((v) => v.slug === slug) || null;
}

/** Caminho nacional da vertical. */
export function verticalPath(v: ServiceVertical) {
  return `/servico/${v.slug}`;
}

/** Caminho da página de cidade, respeitando o estilo de rota da vertical. */
export function verticalCityPath(v: ServiceVertical, citySlug: string) {
  return v.pathStyle === 'legacy' ? handymanCityPath(citySlug) : `/servico/${v.slug}/${citySlug}`;
}

/** Caminho da página de bairro (cidade-bairro no mesmo segmento). */
export function verticalNeighborhoodPath(v: ServiceVertical, citySlug: string, neighborhoodSlug: string) {
  return v.pathStyle === 'legacy'
    ? handymanNeighborhoodPath(citySlug, neighborhoodSlug)
    : `/servico/${v.slug}/${citySlug}-${neighborhoodSlug}`;
}

export interface VerticalSeo {
  title: string;
  description: string;
  keywords: string;
  h1: string;
  canonicalPath: string;
}

function countLabelOf(providerCount: number) {
  return providerCount > 0 ? `${providerCount} profissionais` : 'profissionais';
}

export function buildVerticalSeo(
  v: ServiceVertical,
  place: { cityLabel?: string | null; state?: string | null; citySlug?: string | null; neighborhoodLabel?: string | null; neighborhoodSlug?: string | null } | null,
  providerCount = 0,
): VerticalSeo {
  const cityLabel = place?.cityLabel || '';
  const citySlug = place?.citySlug || '';
  const hoodLabel = place?.neighborhoodLabel || '';
  const hoodSlug = place?.neighborhoodSlug || '';

  if (!cityLabel) {
    return {
      title: `${v.label}: orçamento com profissionais avaliados perto de você`,
      description: `${v.label}: ${v.intro} Veja preços médios, avaliações reais e fale direto com o profissional, sem comissão da plataforma.`,
      keywords: v.keywordSeeds.join(', '),
      h1: `${v.label}: ${v.intro.replace(/\.$/, '')}`,
      canonicalPath: verticalPath(v),
    };
  }

  const region = place?.state ? `${cityLabel} - ${place.state}` : cityLabel;
  const count = countLabelOf(providerCount);

  if (hoodLabel && hoodSlug) {
    return {
      title: `${v.label} no ${hoodLabel}, ${cityLabel} | Orçamento rápido`,
      description: `${v.label} no bairro ${hoodLabel}, em ${region}: ${count} disponíveis. ${v.intro} Avaliações reais e contato direto.`,
      keywords: [...v.keywordSeeds.map((k) => `${k} ${hoodLabel}`), `${v.inlineLabel} ${hoodLabel} ${cityLabel}`, `${v.inlineLabel} ${cityLabel}`].join(', '),
      h1: `${v.label} no ${hoodLabel}, ${cityLabel}`,
      canonicalPath: verticalNeighborhoodPath(v, citySlug, hoodSlug),
    };
  }

  return {
    title: `${v.label} em ${cityLabel}${place?.state ? ` (${place.state})` : ''} | Orçamento rápido`,
    description: `${v.label} em ${region}: ${count} para atender você. ${v.intro} Compare avaliações, veja preços médios e fale direto no WhatsApp.`,
    keywords: [...v.keywordSeeds.map((k) => `${k} ${cityLabel}`), `${v.inlineLabel} em ${cityLabel}`].join(', '),
    h1: `${v.label} em ${cityLabel}`,
    canonicalPath: verticalCityPath(v, citySlug),
  };
}

/**
 * Conteúdo editorial da landing "Marido de aluguel".
 *
 * Fonte única para a página principal (/servico/marido-de-aluguel) e para as
 * páginas regionais programáticas (/marido-de-aluguel-{cidade}).
 * Sem IA: textos curados, reaproveitados no FAQPage JSON-LD e nos metadados.
 */

export const HANDYMAN_SLUG = 'marido-de-aluguel';
export const HANDYMAN_LABEL = 'Marido de aluguel';

export interface HandymanTask {
  title: string;
  description: string;
  icon: string;
}

export const HANDYMAN_TASKS: HandymanTask[] = [
  { icon: 'Wrench', title: 'Pequenos reparos hidráulicos', description: 'Troca de torneira, sifão, registro, reparo de vaso sanitário e vazamentos simples.' },
  { icon: 'Zap', title: 'Elétrica residencial leve', description: 'Troca de tomadas, interruptores, luminárias, chuveiro elétrico e instalação de ventilador de teto.' },
  { icon: 'Hammer', title: 'Fixação e montagem', description: 'Prateleiras, suportes de TV, quadros, cortinas, espelhos e montagem de móveis.' },
  { icon: 'PaintRoller', title: 'Pintura e acabamento', description: 'Retoques de pintura, massa corrida, rejunte, silicone e vedação.' },
  { icon: 'DoorOpen', title: 'Portas, janelas e fechaduras', description: 'Ajuste de portas, troca de fechadura, dobradiças, roldanas e trincos.' },
  { icon: 'Home', title: 'Manutenção preventiva', description: 'Limpeza de calhas, revisão de vedação, ajustes gerais e checklist da casa.' },
];

export interface HandymanStep {
  title: string;
  description: string;
}

export const HANDYMAN_STEPS: HandymanStep[] = [
  { title: '1. Descreva o serviço', description: 'Conte o que precisa ser feito, com fotos ou detalhes do problema. Quanto mais claro, mais preciso o orçamento.' },
  { title: '2. Escolha o profissional', description: 'Compare perfis, avaliações reais, experiência e portfólio dos profissionais que atendem a sua região.' },
  { title: '3. Combine direto', description: 'Fale por WhatsApp ou telefone com o profissional. A negociação de valor e prazo é direta, sem intermediários.' },
  { title: '4. Avalie o resultado', description: 'Depois do serviço, deixe sua avaliação. Isso ajuda outros moradores e valoriza quem trabalha bem.' },
];

export interface HandymanPriceRow {
  service: string;
  range: string;
  note: string;
}

/** Faixas de mercado apenas informativas — o preço final é combinado direto. */
export const HANDYMAN_PRICES: HandymanPriceRow[] = [
  { service: 'Visita técnica / diagnóstico', range: 'R$ 80 a R$ 150', note: 'Muitos profissionais abatem esse valor do serviço contratado.' },
  { service: 'Hora avulsa de serviço', range: 'R$ 70 a R$ 160', note: 'Varia conforme cidade, deslocamento e complexidade.' },
  { service: 'Meio período (até 4h)', range: 'R$ 250 a R$ 500', note: 'Ideal para juntar várias pendências pequenas na mesma visita.' },
  { service: 'Diária (até 8h)', range: 'R$ 450 a R$ 900', note: 'Mais econômico quando há muitos reparos acumulados.' },
  { service: 'Instalação de suporte de TV', range: 'R$ 120 a R$ 280', note: 'Depende do tamanho da TV e do tipo de parede.' },
  { service: 'Troca de chuveiro elétrico', range: 'R$ 100 a R$ 220', note: 'Pode variar se houver necessidade de troca de fiação.' },
];

export interface HandymanFaq {
  question: string;
  answer: string;
}

export function buildHandymanFaq(cityLabel?: string | null): HandymanFaq[] {
  const local = cityLabel ? ` em ${cityLabel}` : '';
  return [
    {
      question: `O que faz um marido de aluguel${local}?`,
      answer: 'É o profissional de manutenção geral que resolve pequenos reparos domésticos: hidráulica leve, elétrica residencial, fixação de prateleiras e suportes, montagem de móveis, ajuste de portas e fechaduras, retoques de pintura e vedação. Serviços que não justificam contratar um especialista para cada tarefa.',
    },
    {
      question: `Quanto custa contratar um marido de aluguel${local}?`,
      answer: 'A maior parte dos profissionais cobra por hora (cerca de R$ 70 a R$ 160), por meio período ou por diária. Serviços simples costumam ficar entre R$ 100 e R$ 300. O valor final depende do tipo de reparo, do material necessário e do deslocamento — combine sempre direto com o profissional antes de iniciar.',
    },
    {
      question: 'O material está incluso no orçamento?',
      answer: 'Normalmente não. O padrão do mercado é cobrar a mão de obra e o cliente fornecer as peças, ou o profissional comprar e repassar o valor com nota. Alinhe isso na hora do orçamento para evitar surpresas.',
    },
    {
      question: 'Preciso pagar a visita mesmo sem fechar o serviço?',
      answer: 'Depende do profissional. Muitos cobram uma taxa de visita/diagnóstico entre R$ 80 e R$ 150, que costuma ser abatida caso o serviço seja aprovado. Pergunte antes de agendar.',
    },
    {
      question: `Como escolher um profissional confiável${local}?`,
      answer: 'Veja as avaliações de outros clientes, o tempo de experiência, o portfólio de trabalhos e a clareza no orçamento. Prefira quem detalha o que será feito, informa prazo e não pede pagamento integral adiantado.',
    },
    {
      question: 'Marido de aluguel faz serviço em condomínio e comércio?',
      answer: 'Sim. Além de residências, muitos atendem escritórios, lojas, salões e áreas comuns de condomínio, geralmente em regime de manutenção por hora ou contrato mensal.',
    },
    {
      question: 'A plataforma cobra alguma comissão?',
      answer: 'Não. O Preciso de um conecta você diretamente ao profissional. A negociação de valores, prazos e forma de pagamento acontece entre as partes, sem taxa da plataforma.',
    },
  ];
}

/** Capitais e grandes centros usados na malha interna de links e no sitemap. */
export const HANDYMAN_CITY_SEEDS: { slug: string; label: string; state: string }[] = [
  { slug: 'sao-paulo', label: 'São Paulo', state: 'SP' },
  { slug: 'rio-de-janeiro', label: 'Rio de Janeiro', state: 'RJ' },
  { slug: 'belo-horizonte', label: 'Belo Horizonte', state: 'MG' },
  { slug: 'curitiba', label: 'Curitiba', state: 'PR' },
  { slug: 'porto-alegre', label: 'Porto Alegre', state: 'RS' },
  { slug: 'florianopolis', label: 'Florianópolis', state: 'SC' },
  { slug: 'salvador', label: 'Salvador', state: 'BA' },
  { slug: 'recife', label: 'Recife', state: 'PE' },
  { slug: 'fortaleza', label: 'Fortaleza', state: 'CE' },
  { slug: 'brasilia', label: 'Brasília', state: 'DF' },
  { slug: 'goiania', label: 'Goiânia', state: 'GO' },
  { slug: 'campinas', label: 'Campinas', state: 'SP' },
  { slug: 'manaus', label: 'Manaus', state: 'AM' },
  { slug: 'belem', label: 'Belém', state: 'PA' },
  { slug: 'vitoria', label: 'Vitória', state: 'ES' },
  { slug: 'natal', label: 'Natal', state: 'RN' },
  { slug: 'joao-pessoa', label: 'João Pessoa', state: 'PB' },
  { slug: 'sao-jose-dos-pinhais', label: 'São José dos Pinhais', state: 'PR' },
];

export function handymanCityPath(citySlug: string) {
  return `/${HANDYMAN_SLUG}-${citySlug}`;
}

export interface HandymanSeo {
  title: string;
  description: string;
  keywords: string;
  h1: string;
  canonicalPath: string;
}

/** Metadados com palavras-chave locais injetadas dinamicamente. */
export function buildHandymanSeo(city?: { label: string; state?: string | null; slug: string } | null, providerCount = 0): HandymanSeo {
  if (!city) {
    return {
      title: 'Marido de aluguel: encontre profissionais de reparos perto de você',
      description: 'Marido de aluguel para pequenos reparos: hidráulica, elétrica, montagem de móveis, fixação e pintura. Veja preços médios, avaliações reais e fale direto com o profissional.',
      keywords: 'marido de aluguel, serviços de marido de aluguel, pequenos reparos residenciais, montagem de móveis, reparo hidráulico, eletricista residencial',
      h1: 'Marido de aluguel: pequenos reparos resolvidos por profissionais avaliados',
      canonicalPath: `/servico/${HANDYMAN_SLUG}`,
    };
  }
  const place = city.state ? `${city.label} - ${city.state}` : city.label;
  const countLabel = providerCount > 0 ? `${providerCount} profissionais` : 'profissionais';
  return {
    title: `Marido de aluguel em ${city.label}${city.state ? ` (${city.state})` : ''} | Orçamento rápido`,
    description: `Marido de aluguel em ${place}: ${countLabel} para reparos hidráulicos, elétricos, montagem de móveis e fixações. Compare avaliações, veja preços médios e fale direto no WhatsApp.`,
    keywords: `marido de aluguel ${city.label}, marido de aluguel em ${city.label}, pequenos reparos ${city.label}, montagem de móveis ${city.label}, manutenção residencial ${city.label}`,
    h1: `Marido de aluguel em ${city.label}`,
    canonicalPath: handymanCityPath(city.slug),
  };
}

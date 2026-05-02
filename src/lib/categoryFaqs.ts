/**
 * FAQs por categoria — usadas em /especialidades/:slug e /categoria/:slug
 * para gerar conteúdo long-tail + JSON-LD FAQPage.
 */
export type CategoryFaq = { q: string; a: string };

const DEFAULT_FAQS: CategoryFaq[] = [
  {
    q: 'Como contratar um profissional pelo Preciso de um?',
    a: 'Você busca pela especialidade ou categoria, compara perfis, avaliações e tempo de resposta, e entra em contato direto pelo WhatsApp. Não cobramos taxa nem intermediamos a negociação.',
  },
  {
    q: 'Os profissionais são verificados?',
    a: 'Os profissionais com selo "Profissional Top" passaram por validações adicionais de identidade, engajamento e avaliações reais. Sempre confira documento, portfólio e nota antes de fechar.',
  },
  {
    q: 'Quanto custa contratar?',
    a: 'O valor é negociado diretamente com o profissional. A plataforma é 100% gratuita para clientes e profissionais, sem mensalidade ou comissão sobre o serviço.',
  },
  {
    q: 'Como saber se o profissional atende minha região?',
    a: 'A busca prioriza profissionais próximos ao seu CEP/cidade. No perfil você confere bairros e cidades atendidas. Em caso de dúvida, pergunte no primeiro contato.',
  },
];

const FAQS_BY_SLUG: Record<string, CategoryFaq[]> = {
  eletricista: [
    { q: 'Quanto custa um eletricista para instalação ou reparo?', a: 'Os valores variam conforme a complexidade. Chamados simples (troca de tomada, disjuntor) começam em torno de R$ 80–R$ 150. Instalações maiores (quadro de luz, ar-condicionado) podem ultrapassar R$ 500. Combine os detalhes diretamente com o profissional, com fotos.' },
    { q: 'O eletricista atende emergências fora do horário comercial?', a: 'Muitos profissionais oferecem atendimento 24h. No filtro de busca, procure pela tag "atendimento de emergência" para encontrar quem trabalha em finais de semana e madrugada.' },
    { q: 'Preciso desligar a energia para receber o serviço?', a: 'Sim, em quase todos os reparos elétricos é necessário desligar o disjuntor geral. O profissional orienta no momento da visita.' },
    { q: 'Eletricista emite nota fiscal?', a: 'Profissionais com a tag "Emite NF-e" podem fornecer nota fiscal — útil para reembolsos de seguro ou condomínios.' },
  ],
  encanador: [
    { q: 'Quanto custa um encanador para resolver vazamento?', a: 'Diagnóstico simples começa em R$ 100–R$ 200. Reparos com troca de tubulação ou caça-vazamento podem variar de R$ 250 a R$ 800 conforme a área afetada.' },
    { q: 'Encanador faz desentupimento?', a: 'Sim. Muitos atendem desentupimento de pia, ralo e vaso sanitário. Filtre por "desentupidor" se for serviço maior com máquina rotativa.' },
    { q: 'O profissional traz as peças?', a: 'Em geral, o cliente paga as peças à parte. Combine diretamente com o profissional se a mão de obra inclui o material.' },
  ],
  diarista: [
    { q: 'Qual o valor de uma diária de limpeza?', a: 'A diária varia entre R$ 130 e R$ 250, dependendo do tamanho do imóvel, cidade e se inclui passar roupa. Combine o escopo antes.' },
    { q: 'Diarista ou faxineira: qual a diferença?', a: 'A diarista trabalha por dia avulso, sem vínculo. A faxineira costuma fazer limpeza pesada esporádica. No site você encontra ambas filtrando pela tag desejada.' },
    { q: 'A diarista traz produto de limpeza?', a: 'Geralmente os produtos são fornecidos pelo contratante. Algumas profissionais cobram à parte se levarem material próprio.' },
  ],
  pedreiro: [
    { q: 'Pedreiro cobra por dia ou por obra?', a: 'Depende. Para pequenos reparos (R$ 200–R$ 400/dia) é por diária. Para obras maiores, combine valores fechados por etapa (alvenaria, contrapiso, acabamento) diretamente com o profissional.' },
    { q: 'O pedreiro ajuda a comprar material?', a: 'Muitos auxiliam na lista de materiais e até buscam no depósito. Combine se há cobrança de deslocamento.' },
  ],
  pintor: [
    { q: 'Como é cobrado o serviço de pintura?', a: 'Pode ser por m², por dia ou por obra fechada. Pintura interna sai de R$ 12 a R$ 25/m² (mão de obra). Externa e textura custam mais.' },
    { q: 'O pintor fornece a tinta?', a: 'O comum é o cliente comprar a tinta. O profissional indica marca e quantidade após visita técnica.' },
  ],
  marceneiro: [
    { q: 'Quanto custa um móvel planejado?', a: 'Móveis planejados variam muito (R$ 1.500/m² a R$ 4.000/m² conforme material e ferragem). Peça projeto 3D e orçamento detalhado por peça.' },
    { q: 'Marceneiro faz reparo em móvel pronto?', a: 'Sim. Muitos atendem ajustes (porta desalinhada, dobradiça, gaveta), além de produção sob medida.' },
  ],
};

const norm = (s?: string | null) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function getCategoryFaqs(categorySlugOrName?: string | null, displayName?: string): CategoryFaq[] {
  const key = norm(categorySlugOrName);
  const specific = FAQS_BY_SLUG[key];
  if (specific && specific.length) return specific;

  // Default contextualizado pelo nome
  const name = displayName || categorySlugOrName || 'esse serviço';
  return [
    {
      q: `Como contratar um profissional de ${name} no Preciso de um?`,
      a: `Busque por "${name}", compare perfis, avaliações e tempo de resposta, e fale direto pelo WhatsApp. A plataforma é 100% gratuita.`,
    },
    ...DEFAULT_FAQS,
  ];
}

/**
 * Pre-written professional description templates per category.
 * Zero-cost alternative to AI generation.
 */

export interface ServiceTemplate {
  label: string;
  description: string;
}

export const SERVICE_TEMPLATES: Record<string, ServiceTemplate[]> = {
  'eletricista': [
    { label: 'Instalação de Chuveiro', description: 'Instalação e manutenção de chuveiros elétricos com segurança e agilidade. Trabalho com todas as marcas e modelos, incluindo troca de resistência e fiação adequada. Atendimento rápido e garantia de serviço.' },
    { label: 'Troca de Fiação', description: 'Serviço completo de troca e reparo de fiação elétrica residencial e comercial. Adequação às normas da ABNT, instalação de disjuntores, tomadas e quadro de distribuição. Orçamento sem compromisso.' },
    { label: 'Instalação Elétrica Completa', description: 'Projeto e execução de instalações elétricas residenciais e comerciais. Instalação de quadros, circuitos, iluminação LED e adequação ao padrão da concessionária. Profissional certificado com garantia.' },
    { label: 'Curto-Circuito e Reparos', description: 'Diagnóstico e reparo de curtos-circuitos, quedas de energia e problemas elétricos em geral. Atendimento de emergência com rapidez e segurança. Prevenção de riscos com manutenção preventiva.' },
  ],
  'encanador': [
    { label: 'Reparo de Vazamento', description: 'Localização e reparo de vazamentos em tubulações, torneiras e registros. Trabalho limpo e rápido, sem quebrar paredes desnecessariamente. Garantia no serviço e materiais de primeira linha.' },
    { label: 'Instalação de Caixa d\'Água', description: 'Instalação, limpeza e manutenção de caixas d\'água e cisternas. Serviço completo com boia, registro e tubulação. Higienização profissional para garantir água limpa.' },
    { label: 'Desentupimento', description: 'Desentupimento de pias, ralos, vasos sanitários e tubulações com equipamentos profissionais. Atendimento rápido, sem sujeira e com garantia. Hidrojateamento disponível.' },
    { label: 'Instalação Hidráulica', description: 'Projeto e execução de instalações hidráulicas para construções e reformas. Instalação de aquecedores, misturadores e sistemas de água quente e fria. Trabalho dentro das normas técnicas.' },
  ],
  'mecanico': [
    { label: 'Revisão Completa', description: 'Revisão completa do veículo incluindo motor, freios, suspensão, direção e parte elétrica. Diagnóstico computadorizado e orçamento detalhado. Peças originais e garantia de serviço.' },
    { label: 'Suspensão e Freios', description: 'Manutenção e troca de componentes de suspensão e freios. Alinhamento, balanceamento e cambagem. Peças de qualidade com garantia e preço justo.' },
    { label: 'Motor e Câmbio', description: 'Reparo e retífica de motores e câmbios manuais e automáticos. Diagnóstico preciso com equipamentos modernos. Profissional experiente com anos de atuação no mercado.' },
    { label: 'Injeção Eletrônica', description: 'Diagnóstico e reparo de sistemas de injeção eletrônica, sensores e módulos. Scanner automotivo de última geração. Solução rápida para falhas, consumo alto e luz do painel acesa.' },
  ],
  'pintor': [
    { label: 'Pintura Residencial', description: 'Pintura interna e externa de casas e apartamentos com acabamento profissional. Preparação completa de superfícies, massa corrida e textura. Tintas de primeira linha e cores personalizadas.' },
    { label: 'Pintura Comercial', description: 'Pintura de escritórios, lojas e espaços comerciais com mínima interferência na rotina. Trabalho limpo, rápido e com acabamento impecável. Atendemos fins de semana e feriados.' },
    { label: 'Textura e Grafiato', description: 'Aplicação de texturas decorativas, grafiato e efeitos especiais em paredes. Variedade de acabamentos e cores. Transforme seus ambientes com sofisticação e bom gosto.' },
  ],
  'pedreiro': [
    { label: 'Reforma Geral', description: 'Reforma completa de casas e apartamentos: alvenaria, reboco, contrapiso, revestimentos e acabamentos. Equipe experiente, trabalho limpo e dentro do prazo. Orçamento gratuito.' },
    { label: 'Construção', description: 'Construção de muros, lajes, estruturas e ampliações residenciais e comerciais. Projeto acompanhado, materiais de qualidade e cumprimento rigoroso de prazos. Experiência comprovada.' },
    { label: 'Reparos e Manutenção', description: 'Reparos em alvenaria, trincas, infiltrações e problemas estruturais. Manutenção preventiva e corretiva com agilidade. Pequenos e grandes reparos com o mesmo padrão de qualidade.' },
  ],
  'instalador-de-ar-condicionado': [
    { label: 'Instalação Split', description: 'Instalação profissional de ar-condicionado split de todas as marcas e capacidades. Serviço completo com suportes, tubulação e parte elétrica. Garantia e nota fiscal.' },
    { label: 'Manutenção e Limpeza', description: 'Limpeza e manutenção preventiva de ar-condicionado split e janela. Higienização completa com produtos antialérgicos. Aumente a vida útil do equipamento e economize energia.' },
    { label: 'Carga de Gás', description: 'Recarga de gás refrigerante para ar-condicionado com detector de vazamento. Verificação completa do sistema. Atendimento residencial e comercial com agilidade.' },
  ],
  'gesseiro': [
    { label: 'Forro de Gesso', description: 'Instalação de forro de gesso liso e decorado para residências e escritórios. Sancas, molduras e nichos com acabamento perfeito. Trabalho limpo e pontual.' },
    { label: 'Drywall', description: 'Construção de paredes, divisórias e forros em drywall. Solução rápida, limpa e econômica para ambientes internos. Isolamento acústico e térmico disponível.' },
  ],
  'profissional-de-beleza': [
    { label: 'Corte e Coloração', description: 'Cortes modernos e coloração profissional com produtos de alta qualidade. Atendimento personalizado para realçar sua beleza natural. Agende seu horário e transforme seu visual.' },
    { label: 'Manicure e Pedicure', description: 'Serviços de manicure e pedicure com higiene rigorosa e materiais esterilizados. Esmaltação tradicional, em gel e nail art. Atendimento em domicílio disponível.' },
  ],
  'fotografo': [
    { label: 'Fotografia de Eventos', description: 'Cobertura fotográfica profissional para casamentos, aniversários e eventos corporativos. Equipamentos de ponta e edição profissional incluída. Entrega rápida em galeria online.' },
    { label: 'Ensaio Fotográfico', description: 'Ensaios fotográficos em estúdio ou locação externa. Book pessoal, familiar e corporativo com direção de poses. Fotos editadas em alta resolução.' },
  ],
  'jardineiro': [
    { label: 'Manutenção de Jardim', description: 'Manutenção completa de jardins: poda, limpeza, adubação e controle de pragas. Corte de grama e paisagismo. Atendimento regular ou avulso com preço justo.' },
    { label: 'Paisagismo', description: 'Projeto e execução de paisagismo residencial e comercial. Plantio, irrigação automatizada e iluminação de jardim. Transforme seu espaço em um ambiente verde e acolhedor.' },
  ],
  'profissional-de-limpeza': [
    { label: 'Limpeza Residencial', description: 'Limpeza completa de casas e apartamentos com produtos profissionais. Faxina pesada, limpeza de vidros e higienização de estofados. Pontualidade e capricho garantidos.' },
    { label: 'Limpeza Pós-Obra', description: 'Limpeza especializada pós-obra e pós-reforma. Remoção de resíduos de tinta, cimento e poeira. Deixamos seu imóvel pronto para uso com brilho e perfeição.' },
  ],
  'marceneiro': [
    { label: 'Móveis Sob Medida', description: 'Projeto e fabricação de móveis sob medida: armários, cozinhas planejadas, closets e estantes. Materiais de qualidade, acabamento fino e montagem profissional. Design personalizado.' },
    { label: 'Reparo de Móveis', description: 'Restauração e reparo de móveis danificados. Troca de dobradiças, corrediças e puxadores. Ajuste de portas, gavetas e estruturas. Seu móvel como novo!' },
  ],
  'advogado': [
    { label: 'Consultoria Jurídica', description: 'Assessoria e consultoria jurídica nas áreas cível, trabalhista, familiar e empresarial. Atendimento presencial e online. Primeira consulta com avaliação do caso sem compromisso.' },
    { label: 'Direito Trabalhista', description: 'Especialista em causas trabalhistas: rescisão, horas extras, assédio e acidentes de trabalho. Defesa de direitos com experiência e comprometimento. Atuação em todas as instâncias.' },
  ],
  'contador': [
    { label: 'Contabilidade Completa', description: 'Serviços contábeis completos para MEI, ME e empresas de todos os portes. Abertura de CNPJ, folha de pagamento, impostos e declarações. Atendimento digital e personalizado.' },
    { label: 'Imposto de Renda', description: 'Declaração de Imposto de Renda Pessoa Física e Jurídica com segurança e agilidade. Análise completa de deduções para maximizar sua restituição. Profissional registrado no CRC.' },
  ],
};

/** Differential tags that apply to any category */
export const DIFFERENTIAL_TAGS = [
  { label: '⏰ Atendimento 24h', value: 'Atendimento disponível 24 horas, inclusive fins de semana e feriados.' },
  { label: '💳 Aceito Cartão', value: 'Aceito pagamento em cartão de crédito e débito, além de Pix.' },
  { label: '✅ Garantia de Serviço', value: 'Todos os serviços possuem garantia por escrito.' },
  { label: '🚗 Atendo a Domicílio', value: 'Atendimento em domicílio sem custo adicional de deslocamento.' },
  { label: '📋 Orçamento Grátis', value: 'Orçamento gratuito e sem compromisso. Entre em contato!' },
  { label: '⭐ Profissional Certificado', value: 'Profissional com certificação e cursos de especialização na área.' },
  { label: '🛡️ NF e Contrato', value: 'Emissão de nota fiscal e contrato de serviço para sua segurança.' },
  { label: '⚡ Atendimento Rápido', value: 'Resposta rápida e atendimento no mesmo dia, sujeito a disponibilidade.' },
];

/**
 * Get templates for a category slug.
 */
export function getTemplatesForCategory(slug: string): ServiceTemplate[] {
  const normalized = slug.toLowerCase().replace(/\s+/g, '-');
  return SERVICE_TEMPLATES[normalized] || [];
}

/**
 * Build an external AI prompt for copy-to-clipboard.
 */
export function buildExternalPrompt(serviceName: string, categoryName?: string, cityName?: string): string {
  return `Escreva uma descrição profissional e persuasiva para um serviço de "${serviceName}"${categoryName ? ` na categoria "${categoryName}"` : ''}${cityName ? ` em ${cityName}` : ''}. A descrição deve ter entre 80-120 palavras, destacar diferenciais, incluir um call-to-action sutil e usar português brasileiro. Não use markdown, apenas texto corrido.`;
}

/**
 * Dicas práticas exibidas pelo ExpertTipsWidget.
 * Chave: slug normalizado da categoria; valor: lista de dicas curtas.
 * Use `getExpertTips(categorySlug)` — sempre retorna ao menos a lista 'default'.
 */
export const EXPERT_TIPS: Record<string, string[]> = {
  default: [
    'Mantenha seu WhatsApp ativo — leads que respondem em até 5 min têm 4× mais chance de fechar.',
    'Adicione 3 fotos reais de trabalhos concluídos para subir nos resultados.',
    'Profissionais com avaliações respondidas convertem 30% mais.',
  ],
  eletricista: [
    'Poste foto de um quadro de luz organizado — é o que mais transmite confiança em chamados elétricos.',
    'Inclua "instalação de tomadas" e "troca de disjuntor" nas suas tags — são as buscas mais frequentes.',
    'Marque "atendimento de emergência" se atende fora do horário comercial: triplica a visibilidade.',
  ],
  encanador: [
    'Foto de tubulação limpa e organizada vale mais que descrição. Mostre o "antes e depois".',
    'Detalhe sua área de cobertura por bairro — buscas por "encanador no [bairro]" são altíssimas.',
    'Se atende vazamentos urgentes, ative o selo de emergência.',
  ],
  diarista: [
    'Mostre fotos de cozinhas ou banheiros que você organizou — é o que cliente busca visualmente.',
    'Liste claramente o que está incluso (passar roupa, lavar louça) e o que não está.',
    'Avaliações com resposta sua aumentam fechamento em 40%.',
  ],
  pedreiro: [
    'Poste fotos de obras concluídas com luz natural — destaca acabamento.',
    'Inclua "pequenos reparos" mesmo se faz obras grandes: capta leads de entrada.',
    'Mencione se faz orçamento gratuito no local.',
  ],
  pintor: [
    'Foto antes/depois é o conteúdo de maior conversão para pintura.',
    'Mencione marcas de tinta que trabalha (Suvinil, Coral) — clientes buscam por isso.',
    'Indique se cobra por m² ou por dia — transparência aumenta confiança.',
  ],
  marceneiro: [
    'Foto de móvel sob medida finalizado, com cliente ao fundo, gera prova social forte.',
    'Tags "móvel planejado" e "cozinha planejada" têm volume de busca alto.',
  ],
};

const norm = (s?: string | null) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function getExpertTips(categorySlugOrName?: string | null): string[] {
  const key = norm(categorySlugOrName);
  return EXPERT_TIPS[key] || EXPERT_TIPS.default;
}

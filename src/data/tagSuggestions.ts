/**
 * Category-based tag suggestions for services.
 * Maps category slugs to suggested tags.
 */
export const TAG_SUGGESTIONS: Record<string, string[]> = {
  // Instalações & reparos
  'eletricista': ['instalação elétrica', 'curto-circuito', 'tomadas', 'disjuntores', 'iluminação', 'fiação'],
  'encanador': ['vazamento', 'caixa d\'água', 'esgoto', 'torneiras', 'tubulação', 'aquecedor'],
  'instalador-de-ar-condicionado': ['split', 'manutenção', 'limpeza', 'instalação', 'BTU', 'gás'],
  'desentupidor': ['pia', 'ralo', 'vaso sanitário', 'esgoto', 'cano', 'hidrojateamento'],
  'chaveiro': ['fechadura', 'chave codificada', 'cofre', 'cadeado', 'porta', '24h'],
  'marido-de-aluguel': ['reparos', 'montagem', 'pintura', 'elétrica', 'hidráulica', 'geral'],

  // Construção & reforma
  'pedreiro': ['alvenaria', 'reboco', 'contrapiso', 'muro', 'laje', 'reforma'],
  'pintor': ['pintura residencial', 'pintura comercial', 'textura', 'grafiato', 'verniz', 'epoxi'],
  'gesseiro': ['forro', 'drywall', 'sanca', 'moldura', 'divisória', 'nicho'],
  'azulejista': ['piso', 'revestimento', 'porcelanato', 'pastilha', 'rejunte', 'assentamento'],
  'serralheiro': ['portão', 'grade', 'corrimão', 'escada', 'estrutura metálica', 'solda'],
  'carpinteiro': ['móveis', 'porta', 'janela', 'deck', 'pergolado', 'madeira'],
  'vidraceiro': ['box', 'espelho', 'janela', 'porta de vidro', 'temperado', 'blindex'],
  'marceneiro': ['armário', 'cozinha planejada', 'guarda-roupa', 'estante', 'mesa', 'sob medida'],

  // Técnico & manutenção
  'tecnico-em-informatica': ['formatação', 'rede', 'hardware', 'software', 'vírus', 'backup'],
  'tecnico-em-celular': ['tela', 'bateria', 'placa', 'conector', 'desbloqueio', 'reparo'],
  'mecanico': ['suspensão', 'freios', 'motor', 'câmbio', 'embreagem', 'injeção eletrônica'],
  'eletricista-automotivo': ['bateria', 'alternador', 'farol', 'alarme', 'som', 'vidro elétrico'],
  'dedetizador': ['baratas', 'cupins', 'ratos', 'formigas', 'mosquitos', 'pragas urbanas'],

  // Beleza & saúde
  'profissional-de-beleza': ['corte', 'coloração', 'escova', 'manicure', 'pedicure', 'sobrancelha'],
  'personal-trainer': ['musculação', 'emagrecimento', 'funcional', 'aeróbico', 'alongamento', 'online'],

  // Especializados
  'fotografo': ['casamento', 'ensaio', 'evento', 'corporativo', 'produto', 'book'],
  'designer-grafico': ['logo', 'identidade visual', 'banner', 'social media', 'flyer', 'embalagem'],
  'advogado': ['trabalhista', 'cível', 'criminal', 'família', 'imobiliário', 'empresarial'],
  'contador': ['imposto de renda', 'MEI', 'CNPJ', 'fiscal', 'contabilidade', 'folha'],
  'arquiteto': ['projeto', 'reforma', 'interiores', 'paisagismo', 'comercial', '3D'],

  // Casa & jardim
  'jardineiro': ['poda', 'paisagismo', 'grama', 'irrigação', 'plantio', 'manutenção'],
  'profissional-de-limpeza': ['residencial', 'comercial', 'pós-obra', 'vidros', 'impermeabilização', 'higienização'],
  'montador-de-moveis': ['montagem', 'desmontagem', 'mudança', 'IKEA', 'armário', 'cozinha'],
};

/**
 * Returns suggested tags for a list of category slugs.
 */
export function getSuggestedTags(categorySlugs: string[]): string[] {
  const all = new Set<string>();
  categorySlugs.forEach(slug => {
    const normalized = slug.toLowerCase().replace(/\s+/g, '-');
    const suggestions = TAG_SUGGESTIONS[normalized];
    if (suggestions) suggestions.forEach(t => all.add(t));
  });
  return Array.from(all).slice(0, 12);
}

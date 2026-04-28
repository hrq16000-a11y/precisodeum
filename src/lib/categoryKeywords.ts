/**
 * categoryKeywords — palavras-chave técnicas por categoria.
 *
 * Usado pelo `serviceQualityLinter.computeAdScore` para premiar (com +15%)
 * descrições que contenham vocabulário técnico esperado da categoria.
 *
 * Slugs alinhados ao catálogo `categories.slug`. Para categorias sem entrada
 * explícita, retornamos uma lista vazia e o critério não conta no score
 * (mas as outras dimensões continuam pontuando).
 *
 * Edição: para acrescentar/refinar termos por categoria, basta editar este
 * arquivo. Não exige migração de banco — fica versionado no front.
 */

const KEYWORDS_BY_CATEGORY: Record<string, string[]> = {
  // Construção / reformas
  eletricista: ['quadro', 'instalação', 'manutenção', 'curto', 'fiação', 'disjuntor', 'tomada', 'voltagem', 'aterramento', 'tubulação'],
  encanador: ['vazamento', 'tubulação', 'desentupimento', 'caixa d\'água', 'sifão', 'esgoto', 'hidráulica', 'registro'],
  pedreiro: ['alvenaria', 'reboco', 'contrapiso', 'fundação', 'cerâmica', 'azulejo', 'reforma', 'acabamento'],
  pintor: ['textura', 'massa corrida', 'verniz', 'esmalte', 'lixamento', 'rolinho', 'demão', 'fachada'],
  marceneiro: ['mdf', 'planejado', 'sob medida', 'móvel', 'projeto', 'verniz', 'dobradiça'],
  serralheiro: ['solda', 'portão', 'grade', 'estrutura metálica', 'corrimão', 'inox'],
  vidraceiro: ['box', 'temperado', 'espelho', 'janela', 'esquadria'],
  // Tecnologia
  programador: ['api', 'integração', 'software', 'sistema', 'aplicativo', 'web', 'mobile', 'banco de dados'],
  'desenvolvedor-web': ['site', 'responsivo', 'wordpress', 'react', 'frontend', 'backend', 'hospedagem'],
  'tecnico-em-informatica': ['formatação', 'manutenção', 'rede', 'wifi', 'configuração', 'backup', 'antivirus'],
  // Estética / saúde
  cabeleireiro: ['corte', 'coloração', 'mechas', 'progressiva', 'hidratação', 'escova'],
  manicure: ['esmaltação', 'gel', 'fibra', 'alongamento', 'spa', 'cutícula'],
  esteticista: ['limpeza de pele', 'massagem', 'drenagem', 'peeling', 'depilação'],
  // Serviços domésticos
  diarista: ['limpeza', 'organização', 'pesada', 'doméstica', 'passar roupa'],
  jardineiro: ['poda', 'paisagismo', 'grama', 'plantio', 'irrigação', 'cerca-viva'],
  'piscineiro': ['tratamento', 'cloro', 'aspiração', 'filtragem', 'manutenção'],
  // Automotivo
  mecanico: ['suspensão', 'freio', 'embreagem', 'injeção', 'diagnóstico', 'revisão'],
  borracheiro: ['pneu', 'alinhamento', 'balanceamento', 'câmara'],
  // Saúde / cuidados
  cuidador: ['idoso', 'acompanhamento', 'medicação', 'mobilidade', 'enfermagem'],
  'personal-trainer': ['treino', 'avaliação física', 'hipertrofia', 'emagrecimento', 'condicionamento'],
  // Educação
  professor: ['aula particular', 'reforço', 'didática', 'pedagogia', 'apostila'],
  // Eventos
  fotografo: ['casamento', 'ensaio', 'evento', 'edição', 'álbum', 'iluminação'],
  'dj': ['casamento', 'evento', 'som', 'iluminação', 'pista'],
};

/**
 * Retorna a lista de palavras-chave esperadas para um conjunto de categorias.
 * Se nenhuma categoria for passada ou nenhuma tiver mapping, retorna [].
 */
export function keywordsForCategorySlugs(slugs: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const raw of slugs) {
    if (!raw) continue;
    const slug = raw.toLowerCase().trim();
    const list = KEYWORDS_BY_CATEGORY[slug];
    if (!list) continue;
    list.forEach((k) => seen.add(k.toLowerCase()));
  }
  return Array.from(seen);
}

/**
 * Conta quantas keywords da categoria aparecem na descrição.
 * Retorna também a lista exata de keywords detectadas (para auditoria).
 */
export function detectCategoryKeywords(
  description: string,
  categorySlugs: ReadonlyArray<string | null | undefined>,
): { matched: string[]; total: number } {
  const total = keywordsForCategorySlugs(categorySlugs).length;
  if (!description || total === 0) return { matched: [], total };
  const norm = description.toLowerCase();
  const expected = keywordsForCategorySlugs(categorySlugs);
  const matched = expected.filter((k) => norm.includes(k));
  return { matched, total };
}

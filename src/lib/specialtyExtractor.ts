/**
 * Extrai termos técnicos / especialidades das descrições e nomes de serviços
 * para destacar no card do prestador. Regras:
 *  - matches case-insensitive
 *  - prioriza palavras compostas / normas técnicas
 *  - retorna no máximo 3 termos únicos, preservando capitalização canônica
 *
 * Não é AI: dicionário curado em memória + heurística simples.
 */

// Dicionário canônico de especialidades. Adicionar com moderação para não poluir o card.
const SPECIALTY_DICT: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: 'NBR 5410', patterns: [/\bnbr\s*-?\s*5410\b/i] },
  { canonical: 'NR-10', patterns: [/\bnr\s*-?\s*10\b/i] },
  { canonical: 'NR-35', patterns: [/\bnr\s*-?\s*35\b/i] },
  { canonical: 'Quadros Elétricos', patterns: [/\bquadros?\s+el[eé]tricos?\b/i] },
  { canonical: 'Fiação', patterns: [/\bfia[cç][aã]o\b/i] },
  { canonical: 'Aterramento', patterns: [/\baterramento\b/i] },
  { canonical: 'SPDA', patterns: [/\bspda\b/i, /\bp[aá]ra-?raios?\b/i] },
  { canonical: 'Ar-Condicionado Split', patterns: [/\bar[\s-]?condicionado\b/i, /\bsplit\b/i] },
  { canonical: 'Caldeiraria', patterns: [/\bcaldeiraria\b/i] },
  { canonical: 'Solda MIG/TIG', patterns: [/\b(mig|tig)\b/i, /\bsolda\b/i] },
  { canonical: 'Drywall', patterns: [/\bdry\s*wall\b/i] },
  { canonical: 'Gesso 3D', patterns: [/\bgesso\s*3d\b/i, /\bgesso\s+decor/i] },
  { canonical: 'Porcelanato', patterns: [/\bporcelanat[oa]\b/i] },
  { canonical: 'Reforma Completa', patterns: [/\breforma\s+completa\b/i] },
  { canonical: 'Vazamentos', patterns: [/\bvazament[oa]s?\b/i] },
  { canonical: 'Desentupimento', patterns: [/\bdesentupiment[oa]\b/i] },
  { canonical: 'Manutenção Preventiva', patterns: [/\bmanuten[cç][aã]o\s+preventiva\b/i] },
  { canonical: 'Pintura Epóxi', patterns: [/\bep[oó]xi\b/i] },
  { canonical: 'Marmoraria', patterns: [/\bm[aá]rmore\b/i, /\bgranito\b/i] },
  { canonical: 'Telhados', patterns: [/\btelhad[oa]s?\b/i] },
  { canonical: 'Câmeras CFTV', patterns: [/\bcftv\b/i, /\bc[aâ]meras?\s+de\s+seguran[cç]a\b/i] },
  { canonical: 'Cerca Elétrica', patterns: [/\bcerca\s+el[eé]trica\b/i] },
  { canonical: 'Alarmes', patterns: [/\balarmes?\b/i] },
  { canonical: 'Automação', patterns: [/\bautoma[cç][aã]o\b/i] },
  { canonical: 'Energia Solar', patterns: [/\benergia\s+solar\b/i, /\bfotovoltaic[oa]\b/i] },
  { canonical: 'Hidráulica', patterns: [/\bhidr[aá]ulic[ao]\b/i] },
  { canonical: 'Esquadrias', patterns: [/\besquadrias?\b/i] },
  { canonical: 'Pisos Laminados', patterns: [/\bpiso\s+laminado\b/i, /\blaminados?\b/i] },
  { canonical: 'Marcenaria Sob Medida', patterns: [/\bsob\s+medida\b/i, /\bmarcenaria\b/i] },
];

export function extractSpecialties(textParts: Array<string | null | undefined>, max = 3): string[] {
  const haystack = textParts.filter(Boolean).join(' \n ');
  if (!haystack || haystack.length < 4) return [];

  const found: string[] = [];
  for (const entry of SPECIALTY_DICT) {
    if (entry.patterns.some((re) => re.test(haystack))) {
      if (!found.includes(entry.canonical)) found.push(entry.canonical);
    }
    if (found.length >= max) break;
  }
  return found;
}

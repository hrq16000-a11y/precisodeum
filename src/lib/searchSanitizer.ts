/**
 * Search Sanitizer — strips PT-BR stop words and normalizes query tokens.
 * Used by SIL and useProviders to clean service terms before matching.
 */

const PT_BR_STOP_WORDS = new Set([
  // Articles / pronouns
  'um', 'uma', 'uns', 'umas', 'o', 'a', 'os', 'as',
  'eu', 'ele', 'ela', 'nos', 'nós', 'voce', 'você',
  'meu', 'minha', 'seu', 'sua', 'esse', 'essa', 'este', 'esta',
  // Prepositions / conjunctions
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'por', 'para', 'pra', 'pro', 'com', 'sem', 'sob', 'sobre',
  'e', 'ou', 'mas', 'que', 'se',
  // Verbs / phrases commonly typed in search
  'preciso', 'quero', 'busco', 'procuro', 'necessito',
  'precisando', 'querendo', 'buscando', 'procurando',
  'contratar', 'encontrar', 'achar',
  // Misc
  'muito', 'mais', 'aqui', 'perto', 'onde', 'como',
  'ter', 'ter', 'isso', 'isto',
]);

/**
 * Remove stop words and normalize tokens for search matching.
 * - Strips accents
 * - Expands hyphens (ar-condicionado → ar condicionado)
 * - Removes stop words
 * - Returns only meaningful tokens (length >= 2)
 */
export function sanitizeSearchTokens(rawQuery: string): string[] {
  if (!rawQuery) return [];

  const expanded = rawQuery
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // expand hyphens into spaces
    .replace(/-/g, ' ')
    .trim();

  const tokens = expanded.split(/\s+/).filter(Boolean);

  return tokens.filter(t => t.length >= 2 && !PT_BR_STOP_WORDS.has(t));
}

/**
 * Join sanitized tokens back into a clean query string.
 */
export function sanitizeQuery(rawQuery: string): string {
  return sanitizeSearchTokens(rawQuery).join(' ');
}

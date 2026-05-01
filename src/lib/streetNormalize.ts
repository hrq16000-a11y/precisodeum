/**
 * Normalização robusta de logradouros para comparação tolerante a variações
 * comuns em endereços brasileiros:
 *  - acentos e maiúsculas/minúsculas
 *  - pontuação (vírgula, hífen, barra, ponto)
 *  - abreviações de tipo de logradouro (R., Av., Tv., Pç. etc.)
 *  - palavras ligantes ("de", "da", "do", "dos", "das", "e")
 *  - múltiplos espaços
 *
 * Usada pelo CompanyAddressForm para detectar conflito real entre o que o
 * usuário digitou e o logradouro sugerido pelo CEP.
 *
 * NÃO usa Intl/Locale — tudo determinístico para passar em testes Vitest.
 */

const ABBREV_MAP: Record<string, string> = {
  r: 'rua',
  rua: 'rua',
  av: 'avenida',
  avn: 'avenida',
  avenida: 'avenida',
  tv: 'travessa',
  trav: 'travessa',
  travessa: 'travessa',
  pc: 'praca',
  pca: 'praca',
  praca: 'praca',
  al: 'alameda',
  alameda: 'alameda',
  rod: 'rodovia',
  rodovia: 'rodovia',
  estr: 'estrada',
  estrada: 'estrada',
  lgo: 'largo',
  largo: 'largo',
  vl: 'vila',
  vila: 'vila',
  jd: 'jardim',
  jardim: 'jardim',
};

const STOPWORDS = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);

/**
 * Normaliza um logradouro para comparação. Retorna string canônica em
 * minúsculas, sem acentos, sem pontuação, sem stopwords e com tipos de
 * logradouro expandidos.
 */
export function normalizeStreet(input: string): string {
  if (!input) return '';
  const stripped = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // pontuação e separadores → espaço
    .replace(/[.,\-/\\;:()"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return '';

  const tokens = stripped.split(' ').filter(Boolean);
  const expanded: string[] = [];
  for (const tok of tokens) {
    if (STOPWORDS.has(tok)) continue;
    const mapped = ABBREV_MAP[tok];
    expanded.push(mapped ?? tok);
  }
  return expanded.join(' ');
}

/** Compara dois logradouros após normalização. */
export function isSameStreet(a: string, b: string): boolean {
  const na = normalizeStreet(a);
  const nb = normalizeStreet(b);
  if (!na || !nb) return false;
  return na === nb;
}

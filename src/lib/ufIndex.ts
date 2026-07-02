/**
 * UF detection and validation for Brazilian states.
 * Used to extract UF from search queries like "Curitiba PR" or "São Paulo/SP".
 */

const UF_TO_STATE: Record<string, string> = {
  ac: 'Acre', al: 'Alagoas', ap: 'Amapá', am: 'Amazonas',
  ba: 'Bahia', ce: 'Ceará', df: 'Distrito Federal', es: 'Espírito Santo',
  go: 'Goiás', ma: 'Maranhão', mt: 'Mato Grosso', ms: 'Mato Grosso do Sul',
  mg: 'Minas Gerais', pa: 'Pará', pb: 'Paraíba', pr: 'Paraná',
  pe: 'Pernambuco', pi: 'Piauí', rj: 'Rio de Janeiro', rn: 'Rio Grande do Norte',
  rs: 'Rio Grande do Sul', ro: 'Rondônia', rr: 'Roraima', sc: 'Santa Catarina',
  sp: 'São Paulo', se: 'Sergipe', to: 'Tocantins',
};

const UF_CAPITALS: Record<string, string> = {
  ac: 'riobranco', al: 'maceio', ap: 'macapa', am: 'manaus',
  ba: 'salvador', ce: 'fortaleza', df: 'brasilia', es: 'vitoria',
  go: 'goiania', ma: 'saoluis', mt: 'cuiaba', ms: 'campogrande',
  mg: 'belohorizonte', pa: 'belem', pb: 'joaopessoa', pr: 'curitiba',
  pe: 'recife', pi: 'teresina', rj: 'riodejaneiro', rn: 'natal',
  rs: 'portoalegre', ro: 'portovelho', rr: 'boavista', sc: 'florianopolis',
  sp: 'saopaulo', se: 'aracaju', to: 'palmas',
};

export function isUF(s: string): boolean {
  return s.toLowerCase() in UF_TO_STATE;
}

export function getUFStateName(uf: string): string | null {
  return UF_TO_STATE[uf.toLowerCase()] || null;
}

export function getUFCapital(uf: string): string | null {
  return UF_CAPITALS[uf.toLowerCase()] || null;
}

/**
 * Extract UF from the end of a query string.
 * Handles: "Curitiba PR", "Curitiba/PR", "Curitiba - PR"
 * Returns { uf, queryWithoutUF } or null.
 */
export function extractUFFromQuery(query: string): { uf: string; queryWithoutUF: string } | null {
  // Match UF at end: "... PR", "... /PR", "... - PR"
  const match = query.match(/^(.+?)\s*[/\-–]?\s*([a-zA-Z]{2})\s*$/);
  if (!match) return null;

  const candidate = match[2].toLowerCase();
  if (!isUF(candidate)) return null;

  return {
    uf: candidate,
    queryWithoutUF: match[1].trim(),
  };
}

export { UF_TO_STATE, UF_CAPITALS };

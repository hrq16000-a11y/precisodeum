/**
 * cepReverseLookup — busca CEP a partir de cidade/UF (+ bairro opcional).
 *
 * Usa o endpoint público do ViaCEP que aceita /ws/UF/CIDADE/LOGRADOURO/json/.
 * Quando o bairro é fornecido, prioriza o resultado cuja `bairro` casa
 * (case-insensitive, normalizado). Senão, devolve o primeiro resultado válido.
 *
 * Não dispara exceção: retorna { ok: false } em qualquer falha.
 */

export interface CepReverseHit {
  cep: string;          // formatado 00000-000
  city: string;
  state: string;
  neighborhood: string;
  street: string;
}

export interface CepReverseSuccess {
  ok: true;
  match: CepReverseHit;
  candidates: CepReverseHit[];
}

export interface CepReverseFailure {
  ok: false;
  reason: 'invalid_input' | 'not_found' | 'network';
}

const TIMEOUT_MS = 5000;

function normalize(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatCep(raw: string): string {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length !== 8) return raw;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Busca CEPs candidatos para uma cidade.
 * - O ViaCEP exige `logradouro` com pelo menos 3 caracteres. Quando o bairro é
 *   informado, usamos ele como termo de busca para aumentar a chance de match.
 * - Caso o bairro seja muito curto (ou ausente), retornamos `not_found` em vez
 *   de chutar — evita sugerir CEP errado.
 */
export async function lookupCepFromCity(input: {
  city: string;
  state: string;
  neighborhood?: string;
}): Promise<CepReverseSuccess | CepReverseFailure> {
  const city = (input.city || '').trim();
  const uf = (input.state || '').trim().toUpperCase();
  const neighborhood = (input.neighborhood || '').trim();
  if (!city || uf.length !== 2) return { ok: false, reason: 'invalid_input' };

  // ViaCEP exige logradouro >= 3. Se o usuário forneceu bairro o usamos como termo.
  // Sem bairro não conseguimos pedir lista — devolvemos not_found graciosamente.
  const term = neighborhood.length >= 3 ? neighborhood : '';
  if (!term) return { ok: false, reason: 'not_found' };

  const cityEnc = encodeURIComponent(city);
  const termEnc = encodeURIComponent(term);
  const url = `https://viacep.com.br/ws/${uf}/${cityEnc}/${termEnc}/json/`;

  try {
    const r = await fetchWithTimeout(url, TIMEOUT_MS);
    if (!r.ok) return { ok: false, reason: 'network' };
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) return { ok: false, reason: 'not_found' };

    const hits: CepReverseHit[] = data
      .map((row: any) => ({
        cep: formatCep(String(row?.cep || '')),
        city: String(row?.localidade || '').trim(),
        state: String(row?.uf || '').trim().toUpperCase(),
        neighborhood: String(row?.bairro || '').trim(),
        street: String(row?.logradouro || '').trim(),
      }))
      .filter((h) => h.cep && h.cep.length === 9);

    if (hits.length === 0) return { ok: false, reason: 'not_found' };

    // Prioriza match exato de bairro quando fornecido.
    const want = normalize(neighborhood);
    const exact = want ? hits.find((h) => normalize(h.neighborhood) === want) : null;
    const match = exact || hits[0];
    return { ok: true, match, candidates: hits };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

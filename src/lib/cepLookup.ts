/**
 * Busca confiável por CEP com validação e fallback.
 *
 * Estratégia:
 *  1) Sanitiza o input — só dígitos, exatamente 8.
 *  2) Tenta BrasilAPI (rápida e estável).
 *  3) Em caso de erro/timeout, faz fallback para ViaCEP.
 *  4) Normaliza o resultado em { cep, city, state, neighborhood, address }.
 *
 * Não dispara exceção por CEP inválido — retorna { ok: false, reason }.
 */

export interface CepResult {
  ok: true;
  cep: string;          // formatado 00000-000
  city: string;         // ex: "São Paulo"
  state: string;        // 2 letras (UF)
  neighborhood?: string;
  address?: string;     // logradouro, quando houver
  source: 'brasilapi' | 'viacep';
}

export interface CepFailure {
  ok: false;
  reason: 'invalid_format' | 'not_found' | 'network';
  message: string;
}

const TIMEOUT_MS = 4000;

/** Mantém apenas dígitos. */
export function onlyDigits(input: string): string {
  return (input || '').replace(/\D+/g, '');
}

/** Aceita máscara 00000-000 e dígitos puros. Retorna 8 dígitos ou null. */
export function normalizeCep(input: string): string | null {
  const digits = onlyDigits(input);
  if (digits.length !== 8) return null;
  // 00000000 e 99999999 são notoriamente inválidos
  if (digits === '00000000' || digits === '99999999') return null;
  return digits;
}

/** Formata 8 dígitos em 00000-000. */
export function formatCep(cep8: string): string {
  return `${cep8.slice(0, 5)}-${cep8.slice(5)}`;
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

async function fromBrasilApi(cep8: string): Promise<CepResult | null> {
  try {
    const r = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v2/${cep8}`, TIMEOUT_MS);
    if (!r.ok) return null;
    const data = await r.json();
    if (!data?.city || !data?.state) return null;
    return {
      ok: true,
      cep: formatCep(cep8),
      city: String(data.city).trim(),
      state: String(data.state).trim().toUpperCase(),
      neighborhood: data.neighborhood ? String(data.neighborhood).trim() : undefined,
      address: data.street ? String(data.street).trim() : undefined,
      source: 'brasilapi',
    };
  } catch {
    return null;
  }
}

async function fromViaCep(cep8: string): Promise<CepResult | null> {
  try {
    const r = await fetchWithTimeout(`https://viacep.com.br/ws/${cep8}/json/`, TIMEOUT_MS);
    if (!r.ok) return null;
    const data = await r.json();
    if (data?.erro) return null;
    if (!data?.localidade || !data?.uf) return null;
    return {
      ok: true,
      cep: formatCep(cep8),
      city: String(data.localidade).trim(),
      state: String(data.uf).trim().toUpperCase(),
      neighborhood: data.bairro ? String(data.bairro).trim() : undefined,
      address: data.logradouro ? String(data.logradouro).trim() : undefined,
      source: 'viacep',
    };
  } catch {
    return null;
  }
}

export async function lookupCep(input: string): Promise<CepResult | CepFailure> {
  const cep8 = normalizeCep(input);
  if (!cep8) {
    return {
      ok: false,
      reason: 'invalid_format',
      message: 'Informe um CEP válido (8 dígitos).',
    };
  }
  // Tenta BrasilAPI; em caso de erro, ViaCEP.
  const primary = await fromBrasilApi(cep8);
  if (primary) return primary;
  const secondary = await fromViaCep(cep8);
  if (secondary) return secondary;
  return {
    ok: false,
    reason: 'not_found',
    message: 'CEP não encontrado. Confira os dígitos ou use o filtro por cidade.',
  };
}

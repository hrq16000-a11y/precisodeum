/**
 * citySuggestions — sugere cidades/UF a partir de um CEP parcial ou inválido.
 *
 * Estratégia:
 *   - Tenta resolver progressivamente (CEP "encurtado" → faixa CEP).
 *   - Cai em busca por prefixo na tabela `cities` se houver tradução conhecida.
 *
 * Mantemos local e leve: nada de lib externa. Se um dia houver tabela
 * `cep_ranges`, basta plugar aqui.
 */
import { supabase } from '@/integrations/supabase/client';
import { onlyDigits } from '@/lib/cepLookup';

export interface CitySuggestion {
  city: string;
  state: string;
  source: 'brasilapi-prefix' | 'fallback';
}

const TIMEOUT_MS = 3500;

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
 * Tenta variações progressivas do CEP (substituindo últimos dígitos por 0)
 * para descobrir cidade/UF mesmo quando o CEP exato não existe.
 */
async function tryProgressive(cep: string): Promise<CitySuggestion | null> {
  if (cep.length < 5) return null;
  const variants: string[] = [];
  // 5 + 0s, 4 + 0s, 3 + 0s
  for (const n of [5, 4, 3]) {
    if (cep.length >= n) variants.push(cep.slice(0, n).padEnd(8, '0'));
  }
  for (const v of variants) {
    try {
      const r = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v2/${v}`, TIMEOUT_MS);
      if (!r.ok) continue;
      const data = await r.json();
      if (data?.city && data?.state) {
        return {
          city: String(data.city).trim(),
          state: String(data.state).trim().toUpperCase(),
          source: 'brasilapi-prefix',
        };
      }
    } catch {/* try next */}
  }
  return null;
}

async function fromLocalCities(prefix: string, limit = 6): Promise<CitySuggestion[]> {
  if (!prefix || prefix.length < 2) return [];
  try {
    const { data } = await (supabase as any)
      .from('cities')
      .select('name, state')
      .ilike('name', `${prefix}%`)
      .limit(limit);
    return (data || []).map((c: any) => ({
      city: c.name as string,
      state: (c.state as string).toUpperCase(),
      source: 'fallback' as const,
    }));
  } catch {
    return [];
  }
}

/**
 * Recebe um CEP (parcial ou completo) e retorna sugestões de cidades.
 * Sempre retorna array (vazio quando nada).
 */
export async function suggestCitiesFromCep(input: string): Promise<CitySuggestion[]> {
  const digits = onlyDigits(input);
  if (digits.length === 0) return [];
  // 1) Tenta progressivo via BrasilAPI (mesmo se não estava 8 dígitos)
  const guess = await tryProgressive(digits);
  if (guess) return [guess];
  return [];
}

/**
 * Sugestões locais por nome de cidade (prefix).
 */
export async function suggestCitiesByName(prefix: string): Promise<CitySuggestion[]> {
  return fromLocalCities(prefix);
}

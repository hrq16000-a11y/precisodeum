// Centralized helpers to format city/state safely.
// Avoids leaking corrupt values like "ST", "Sa", "Sã" (legacy bug from string slicing) into the UI.

const VALID_UF = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]);

const STATE_NAME_TO_UF: Record<string, string> = {
  'acre': 'AC', 'alagoas': 'AL', 'amapa': 'AP', 'amapá': 'AP', 'amazonas': 'AM',
  'bahia': 'BA', 'ceara': 'CE', 'ceará': 'CE', 'distrito federal': 'DF',
  'espirito santo': 'ES', 'espírito santo': 'ES', 'goias': 'GO', 'goiás': 'GO',
  'maranhao': 'MA', 'maranhão': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', 'para': 'PA', 'pará': 'PA', 'paraiba': 'PB', 'paraíba': 'PB',
  'parana': 'PR', 'paraná': 'PR', 'pernambuco': 'PE', 'piaui': 'PI', 'piauí': 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
  'rondonia': 'RO', 'rondônia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC',
  'sao paulo': 'SP', 'são paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO',
};

export function isValidUF(state?: string | null): boolean {
  if (!state) return false;
  const s = String(state).trim().toUpperCase();
  return s.length === 2 && VALID_UF.has(s);
}

/**
 * Single source of truth for normalizing any state/UF input into a 2-letter UF code.
 * NEVER uses slice() — returns null for unknown inputs to avoid leaking "St"/"Sa".
 *
 * Accepts: "SP", "sp", " sp ", "São Paulo", "sao paulo", "RIO DE JANEIRO".
 * Rejects: "St", "Sa", "Brasil", "" — always returns null.
 */
export function normalizeUF(state?: string | null): string | null {
  if (!state) return null;
  const trimmed = String(state).trim();
  if (!trimmed) return null;

  // Already a 2-letter UF (any case, with whitespace)
  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && VALID_UF.has(upper)) return upper;

  // Try full state name (case-insensitive, accent-aware via map keys)
  const lower = trimmed.toLowerCase();
  return STATE_NAME_TO_UF[lower] ?? null;
}

/**
 * Returns the UF as a 2-letter string for display, or empty string if invalid/unknown.
 * Use this in any UI rendering of state to prevent corrupt outputs.
 */
export function safeUF(state?: string | null): string {
  return normalizeUF(state) ?? '';
}

/**
 * Returns "City - UF" when both are valid. Falls back to just City, or empty string.
 * @param sep separator between city and UF (default " - ")
 */
export function formatCityState(
  city?: string | null,
  state?: string | null,
  sep: string = ' - '
): string {
  const c = (city || '').trim();
  const uf = safeUF(state);
  if (!c) return '';
  return uf ? `${c}${sep}${uf}` : c;
}

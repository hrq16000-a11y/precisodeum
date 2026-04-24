// Centralized helpers to format city/state safely.
// Avoids leaking corrupt values like "ST" (legacy bug) into the UI.

const VALID_UF = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]);

export function isValidUF(state?: string | null): boolean {
  if (!state) return false;
  const s = String(state).trim().toUpperCase();
  return s.length === 2 && VALID_UF.has(s);
}

export function safeUF(state?: string | null): string {
  return isValidUF(state) ? String(state).trim().toUpperCase() : '';
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

/**
 * Remove protocolo (http/https) e prefixo www. de uma URL para exibição limpa.
 * Mantém querystring e path. Usar apenas para texto visível, nunca para href.
 */
export function prettyUrl(raw?: string | null): string {
  if (!raw) return '';
  try {
    return raw
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/+$/, '');
  } catch {
    return raw;
  }
}

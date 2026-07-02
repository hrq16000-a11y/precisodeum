/**
 * Centralized formatting utilities for dates, currency, and empty-value handling.
 * Uses native Intl APIs — no external dependencies.
 */

const dateFull = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const dateShort = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const currencyFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Format a date string to a full readable date (e.g. "27 de março de 2026").
 * Returns empty string if input is falsy.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return dateFull.format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

/**
 * Format a date string to a short date (e.g. "27 de mar. de 2026").
 */
export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return dateShort.format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

/**
 * Format a deadline date, returning a readable string or empty.
 */
export function formatDeadline(dateStr: string | null | undefined): string {
  return formatDateShort(dateStr);
}

/**
 * Format a number or numeric string as BRL currency.
 * If the value is already a formatted string (contains R$), returns as-is.
 */
export function formatCurrency(value: string | number | null | undefined): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    if (value.includes('R$')) return value;
    const num = parseFloat(value.replace(/[^\d.,\-]/g, '').replace(',', '.'));
    if (isNaN(num)) return value; // return raw string if not parseable
    return currencyFmt.format(num);
  }
  return currencyFmt.format(value);
}

/**
 * Relative time ago string (e.g. "5min atrás", "ontem", "3 dias atrás").
 */
export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return 'ontem';
  if (days < 7) return `${days} dias atrás`;
  if (days < 30) return `${Math.floor(days / 7)} sem atrás`;
  return formatDateShort(dateStr);
}

/**
 * Returns null if value is empty/whitespace so the caller can skip rendering.
 */
export function emptyToNull(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  return value;
}

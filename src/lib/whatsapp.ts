/**
 * Global WhatsApp sanitization, validation, and link generation.
 *
 * Canonical format: 55 + DDD + NUMBER (only digits)
 * Example: 554197452053
 *
 * Rules:
 * - Strip everything except digits 0-9
 * - Remove leading zeros
 * - Valid: 10-11 digits (DDD + number) or 12-13 digits (55 + DDD + number)
 * - Auto-fill: if WhatsApp is empty, copy from phone
 * - Links always use wa.me/{canonical}
 */

const DEFAULT_MESSAGE = 'Olá, vim pelo site Preciso de Um.';

/** Remove all non-digit characters and leading zeros */
export const sanitizePhone = (raw: string): string =>
  raw.replace(/\D/g, '').replace(/^0+/, '');

/**
 * Convert any phone input to canonical format: 55DDDNUMBER
 * Returns empty string if invalid.
 */
export const toCanonical = (input: string): string => {
  const digits = sanitizePhone(input);
  if (!digits) return '';
  // Already canonical: starts with 55 and 12-13 digits total
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  // Raw DDD + number: 10-11 digits
  if (digits.length === 10 || digits.length === 11) {
    return '55' + digits;
  }
  // Invalid length — return empty
  return '';
};

/** Validate: accepts raw (10-11 digits) or canonical (55 + 10-11 digits) */
export const isValidWhatsApp = (sanitized: string): boolean => {
  if (/^\d{10,11}$/.test(sanitized)) return true;
  if (/^55\d{10,11}$/.test(sanitized)) return true;
  return false;
};

/** Format number for WhatsApp: ensure country code 55 (uses toCanonical) */
export const formatToWhatsApp = (phone: string): string => {
  return toCanonical(phone);
};

/** Generate wa.me link with optional message (message is ALWAYS preserved) */
export const whatsappLink = (number: string, message?: string): string => {
  const formatted = formatToWhatsApp(number);
  if (!formatted) return '#';
  const text = message || DEFAULT_MESSAGE;
  return `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
};

/**
 * Format for display: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
 * Handles canonical format by stripping 55 prefix first.
 */
export const formatPhoneDisplay = (sanitized: string): string => {
  let d = sanitized;
  // Strip 55 country code if canonical format
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    d = d.substring(2);
  }
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return sanitized;
};

/**
 * Auto-fill WhatsApp from phone if WhatsApp is empty.
 * Returns canonical format (55DDDNUMBER).
 */
export const autoFillWhatsApp = (whatsapp: string, phone: string): string => {
  const canonical = toCanonical(whatsapp);
  if (canonical) return canonical;
  return toCanonical(phone);
};

/**
 * Generate tel: link. Returns canonical format for consistency.
 */
export const telLink = (phone: string): string => {
  const canonical = toCanonical(phone);
  if (!canonical) return '';
  return `tel:${canonical}`;
};

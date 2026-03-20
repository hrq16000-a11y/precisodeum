/**
 * Global WhatsApp sanitization, validation, and link generation.
 *
 * Rules:
 * - Strip everything except digits 0-9
 * - Remove leading zeros
 * - Valid: 10-11 digits (DDD + number)
 * - Auto-fill: if WhatsApp is empty, copy from phone
 * - Links always use wa.me/55{number}
 */

const DEFAULT_MESSAGE = 'Olá, vim pelo site Preciso de Um.';

/** Remove all non-digit characters and leading zeros */
export const sanitizePhone = (raw: string): string =>
  raw.replace(/\D/g, '').replace(/^0+/, '');

/** Validate: 10 or 11 digits after sanitization */
export const isValidWhatsApp = (sanitized: string): boolean =>
  /^\d{10,11}$/.test(sanitized);

/** Format number for WhatsApp: ensure country code 55 */
export const formatToWhatsApp = (phone: string): string => {
  let cleaned = sanitizePhone(phone);
  if (!cleaned) return '';
  // If already starts with 55 and has 12-13 digits total, keep as-is
  if (cleaned.startsWith('55') && cleaned.length >= 12) return cleaned;
  // Add country code
  return '55' + cleaned;
};

/** Generate wa.me link with optional message (message is ALWAYS preserved) */
export const whatsappLink = (number: string, message?: string): string => {
  const formatted = formatToWhatsApp(number);
  if (!formatted) return '#';
  const text = message || DEFAULT_MESSAGE;
  return `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
};

/** Format for display: (XX) XXXXX-XXXX or (XX) XXXX-XXXX */
export const formatPhoneDisplay = (sanitized: string): string => {
  if (sanitized.length === 11) {
    return `(${sanitized.slice(0, 2)}) ${sanitized.slice(2, 7)}-${sanitized.slice(7)}`;
  }
  if (sanitized.length === 10) {
    return `(${sanitized.slice(0, 2)}) ${sanitized.slice(2, 6)}-${sanitized.slice(6)}`;
  }
  return sanitized;
};

/**
 * Auto-fill WhatsApp from phone if WhatsApp is empty.
 * Returns the value that should be used for WhatsApp.
 */
export const autoFillWhatsApp = (whatsapp: string, phone: string): string => {
  const cleanWa = sanitizePhone(whatsapp);
  if (cleanWa) return cleanWa;
  return sanitizePhone(phone);
};

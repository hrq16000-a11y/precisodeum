/**
 * Global WhatsApp sanitization, validation, and link generation.
 *
 * Rules:
 * - Strip everything except digits 0-9
 * - Remove leading zeros
 * - Valid: 10-11 digits (DDD + number)
 * - Auto-fill: if WhatsApp is empty, copy from phone
 * - Links always use wa.me/{number}
 */

/** Remove all non-digit characters and leading zeros */
export const sanitizePhone = (raw: string): string =>
  raw.replace(/\D/g, '').replace(/^0+/, '');

/** Validate: 10 or 11 digits after sanitization */
export const isValidWhatsApp = (sanitized: string): boolean =>
  /^\d{10,11}$/.test(sanitized);

/** Generate wa.me link with optional message */
export const whatsappLink = (number: string, message?: string): string => {
  const clean = sanitizePhone(number);
  const base = `https://wa.me/${clean}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
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

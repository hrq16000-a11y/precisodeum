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

const DEFAULT_MESSAGE = 'Olá, vi o seu perfil no Preciso de um e gostaria de um orçamento.';

/**
 * Build a structured WhatsApp message with provider name, category, and user location.
 * Falls back to a simpler message if fields are missing.
 */
export const buildSmartMessage = (
  providerName: string,
  category?: string | null,
  userCity?: string | null,
  userState?: string | null,
): string => {
  const catPart = category ? ` Preciso de ajuda com ${category}.` : '';
  const locationParts = [userCity, userState].filter(Boolean).join('/');
  const locPart = locationParts ? ` Minha localização aproximada é ${locationParts}.` : '';
  return `Olá ${providerName}! Vi seu perfil no Preciso de Um.${catPart}${locPart} Podemos conversar?`;
};

/** Detect mobile device via user agent */
const isMobileDevice = (): boolean =>
  typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

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
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return '55' + digits;
  }
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

/** Deep link nativo whatsapp://send (mobile) */
export const whatsappDeepLink = (number: string, message?: string): string => {
  const formatted = formatToWhatsApp(number);
  if (!formatted) return '#';
  const text = message || DEFAULT_MESSAGE;
  return `whatsapp://send?phone=${formatted}&text=${encodeURIComponent(text)}`;
};

/** Link web wa.me (desktop fallback) */
export const whatsappWebLink = (number: string, message?: string): string => {
  const formatted = formatToWhatsApp(number);
  if (!formatted) return '#';
  const text = message || DEFAULT_MESSAGE;
  return `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
};

/** Generate WhatsApp link — deep link on mobile, wa.me on desktop */
export const whatsappLink = (number: string, message?: string): string => {
  if (isMobileDevice()) {
    return whatsappDeepLink(number, message);
  }
  return whatsappWebLink(number, message);
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

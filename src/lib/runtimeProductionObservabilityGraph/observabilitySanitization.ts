const PII_KEYS = new Set([
  'email',
  'phone',
  'whatsapp',
  'cpf',
  'cnpj',
  'city',
  'address',
  'street',
  'payload',
  'raw',
  'json',
  'token',
  'password',
  'secret',
  'apikey',
  'ip',
  'url',
  'href',
  'document',
  'session',
  'cookie',
]);

export function sanitizeObservability<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeObservability(v)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (PII_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = sanitizeObservability(v);
    }
  }
  return out as unknown as T;
}

export const __PII_KEYS_INTERNAL: ReadonlySet<string> = PII_KEYS;

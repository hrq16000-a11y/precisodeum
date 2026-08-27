/**
 * Normalização estrita + rate limiting local para formulários de lead.
 * Puro (exceto o storage injetável) para permitir testes unitários.
 */

export interface NormalizedPhone {
  ok: boolean;
  /** Formato E.164 sem "+" (ex.: 5541999998888). */
  value: string;
  reason?: 'empty' | 'too_short' | 'too_long' | 'invalid_ddd' | 'repeated_digits';
}

const REPEATED = /^(\d)\1+$/;

export function normalizePhoneBr(raw: string | null | undefined): NormalizedPhone {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return { ok: false, value: '', reason: 'empty' };
  if (REPEATED.test(digits)) return { ok: false, value: '', reason: 'repeated_digits' };

  let local = digits;
  if (local.startsWith('55') && local.length > 11) local = local.slice(2);
  if (local.startsWith('0')) local = local.replace(/^0+/, '');

  if (local.length < 10) return { ok: false, value: '', reason: 'too_short' };
  if (local.length > 11) return { ok: false, value: '', reason: 'too_long' };

  const ddd = Number(local.slice(0, 2));
  if (ddd < 11 || ddd > 99) return { ok: false, value: '', reason: 'invalid_ddd' };

  return { ok: true, value: `55${local}` };
}

export interface NormalizedEmail {
  ok: boolean;
  value: string;
  reason?: 'empty' | 'invalid' | 'disposable';
}

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const DISPOSABLE = new Set([
  'mailinator.com',
  'tempmail.com',
  'guerrillamail.com',
  'yopmail.com',
  '10minutemail.com',
  'trashmail.com',
]);

export function normalizeEmail(raw: string | null | undefined, opts: { required?: boolean } = {}): NormalizedEmail {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return { ok: !opts.required, value: '', reason: opts.required ? 'empty' : undefined };
  if (value.length > 200 || !EMAIL_RE.test(value)) return { ok: false, value: '', reason: 'invalid' };
  const domain = value.split('@')[1] ?? '';
  if (DISPOSABLE.has(domain)) return { ok: false, value: '', reason: 'disposable' };
  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Rate limiting local (por navegador). A camada definitiva continua sendo RLS
// + limites no banco; isso apenas corta o abuso trivial antes do INSERT.
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  /** Janela em ms. */
  windowMs: number;
  /** Máximo de envios na janela. */
  max: number;
  /** Intervalo mínimo entre dois envios. */
  minIntervalMs: number;
}

export const LEAD_RATE_LIMIT: RateLimitConfig = {
  windowMs: 10 * 60 * 1000,
  max: 3,
  minIntervalMs: 20 * 1000,
};

export interface RateLimitResult {
  allowed: boolean;
  reason?: 'too_fast' | 'quota';
  retryInMs?: number;
}

interface MiniStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function readTimestamps(storage: MiniStorage, key: string): number[] {
  try {
    const parsed = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export function checkLeadRateLimit(
  key: string,
  now: number,
  storage: MiniStorage,
  config: RateLimitConfig = LEAD_RATE_LIMIT,
): RateLimitResult {
  const stamps = readTimestamps(storage, key).filter((t) => now - t < config.windowMs);
  const last = stamps.length ? Math.max(...stamps) : 0;

  if (last && now - last < config.minIntervalMs) {
    return { allowed: false, reason: 'too_fast', retryInMs: config.minIntervalMs - (now - last) };
  }
  if (stamps.length >= config.max) {
    const oldest = Math.min(...stamps);
    return { allowed: false, reason: 'quota', retryInMs: config.windowMs - (now - oldest) };
  }
  return { allowed: true };
}

export function recordLeadSubmission(
  key: string,
  now: number,
  storage: MiniStorage,
  config: RateLimitConfig = LEAD_RATE_LIMIT,
): void {
  const stamps = readTimestamps(storage, key).filter((t) => now - t < config.windowMs);
  stamps.push(now);
  try {
    storage.setItem(key, JSON.stringify(stamps));
  } catch {
    /* storage indisponível — segue sem persistir */
  }
}

export function rateLimitMessage(result: RateLimitResult): string {
  const secs = Math.max(1, Math.ceil((result.retryInMs || 0) / 1000));
  if (result.reason === 'too_fast') return `Aguarde ${secs}s antes de enviar novamente.`;
  const mins = Math.max(1, Math.ceil(secs / 60));
  return `Você já enviou vários pedidos. Tente novamente em ${mins} min.`;
}

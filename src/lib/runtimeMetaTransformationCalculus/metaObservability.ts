// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Observability
// Pure, PII-free observability. Deterministic serialization. Read-only.

const STAGE_0 = 'STAGE_0_READ_ONLY' as const;

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const k of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[k]);
  }
  return value;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k])).join(',') + '}';
}

function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return 'obs_' + h.toString(16).padStart(8, '0');
}

export type MetaObservabilitySeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'email',
  'phone',
  'whatsapp',
  'cpf',
  'cnpj',
  'tax_id',
  'taxid',
  'city',
  'address',
  'street',
  'neighborhood',
  'cep',
  'postal',
  'postalcode',
  'ip',
  'url',
  'href',
  'raw',
  'payload',
  'json',
  'name',
  'fullname',
  'firstname',
  'lastname',
  'username',
  'document',
  'token',
  'password',
  'secret',
  'apikey',
  'api_key',
]);

const REDACTED = '[REDACTED]' as const;

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  if (SENSITIVE_KEYS.has(k)) return true;
  for (const s of SENSITIVE_KEYS) if (k.includes(s)) return true;
  return false;
}

export function stripMetaSensitiveFields<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => stripMetaSensitiveFields(v)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>).sort()) {
    const v = (value as Record<string, unknown>)[k];
    if (isSensitiveKey(k)) {
      out[k] = REDACTED;
    } else {
      out[k] = stripMetaSensitiveFields(v);
    }
  }
  return out as unknown as T;
}

export function sanitizeMetaPayload<T>(payload: T): T {
  const cleaned = stripMetaSensitiveFields(payload);
  return deepFreeze(cleaned);
}

export interface MetaObservabilityEvent {
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly kind: string;
  readonly severity: MetaObservabilitySeverity;
  readonly signature: string;
  readonly payload: unknown;
  readonly liveExecutionEnabled: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly realUsersAllowed: false;
}

export function classifyMetaObservabilitySeverity(payload: unknown): MetaObservabilitySeverity {
  if (payload === null || payload === undefined) return 'NONE';
  const text = stableStringify(payload).toLowerCase();
  if (text.includes('"critical"') || text.includes('collapsed') || text.includes('mutation_leakage')) return 'CRITICAL';
  if (text.includes('"error"') || text.includes('unstable') || text.includes('broken')) return 'HIGH';
  if (text.includes('"warn"') || text.includes('weak') || text.includes('partial')) return 'MEDIUM';
  if (text.includes('"info"')) return 'LOW';
  return 'NONE';
}

export function detectMetaObservabilityLeak(payload: unknown): boolean {
  if (payload === null || typeof payload !== 'object') return false;
  let leak = false;
  const visit = (v: unknown): void => {
    if (leak) return;
    if (v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const x of v) visit(x);
      return;
    }
    for (const k of Object.keys(v as Record<string, unknown>)) {
      if (isSensitiveKey(k) && (v as Record<string, unknown>)[k] !== REDACTED) {
        leak = true;
        return;
      }
      visit((v as Record<string, unknown>)[k]);
    }
  };
  visit(payload);
  return leak;
}

export function computeMetaObservabilitySignature(event: { readonly kind: string; readonly payload: unknown }): string {
  return hash(stableStringify({ k: event.kind, p: event.payload }));
}

export function buildMetaObservabilityEvent(
  kind: string,
  payload: unknown,
): MetaObservabilityEvent {
  const safePayload = sanitizeMetaPayload(payload);
  const severity = classifyMetaObservabilitySeverity(safePayload);
  const signature = computeMetaObservabilitySignature({ kind, payload: safePayload });
  const event: MetaObservabilityEvent = {
    stage: STAGE_0,
    kind,
    severity,
    signature,
    payload: safePayload,
    liveExecutionEnabled: false,
    retryEnabled: false,
    backgroundEnabled: false,
    realUsersAllowed: false,
  };
  return deepFreeze(event);
}

export const __meta_observability_internals = deepFreeze({
  stage: STAGE_0,
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
});

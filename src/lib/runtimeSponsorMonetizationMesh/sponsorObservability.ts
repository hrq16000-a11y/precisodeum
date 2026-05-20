/**
 * Phase 1.9.14 — Observability. PII-free, deterministic event projection.
 */
import type { SponsorAllocationResult, SponsorExposureEvent } from './sponsorMeshTypes';
import { deepFreeze, signObject } from './sponsorMeshInternals';

const PII_KEYS = new Set([
  'email',
  'cpf',
  'cnpj',
  'phone',
  'whatsapp',
  'token',
  'password',
  'address',
]);

export function scrub<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(input).sort()) {
    if (PII_KEYS.has(k.toLowerCase())) continue;
    const v = input[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = scrub(v as Record<string, unknown>);
    } else {
      out[k] = v as unknown;
    }
  }
  return out;
}

export interface SponsorObservabilityEvent {
  readonly type: 'exposure' | 'allocation';
  readonly signature: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export function observeExposures(
  events: ReadonlyArray<SponsorExposureEvent>,
): ReadonlyArray<SponsorObservabilityEvent> {
  return deepFreeze(
    events.map((e) => {
      const payload = scrub({ ...e });
      return { type: 'exposure', signature: signObject(payload), payload };
    }),
  );
}

export function observeAllocations(
  results: ReadonlyArray<SponsorAllocationResult>,
): ReadonlyArray<SponsorObservabilityEvent> {
  return deepFreeze(
    results.map((r) => {
      const payload = scrub({ ...r });
      return { type: 'allocation', signature: signObject(payload), payload };
    }),
  );
}

/**
 * Phase 1.9.46 — Envelope runtime (shared, read-only).
 */
import { deepFreeze } from './metaPlaneDeepFreeze';
import { signObject } from './metaPlaneFNV';

export interface DeterministicEnvelope<P> {
  readonly version: 'v1';
  readonly payload: P;
  readonly envelopeSignature: string;
  readonly locked: true;
}

export function createDeterministicEnvelope<P>(payload: P): DeterministicEnvelope<P> {
  const frozenPayload = deepFreeze(payload);
  const envelopeSignature = signObject(frozenPayload);
  return deepFreeze({
    version: 'v1' as const,
    payload: frozenPayload,
    envelopeSignature,
    locked: true as const,
  });
}

export function lockDeterministicEnvelope<P>(env: DeterministicEnvelope<P>): DeterministicEnvelope<P> {
  return Object.isFrozen(env) ? env : deepFreeze(env);
}

export function assertEnvelopeDeterminism<P>(env: DeterministicEnvelope<P>): boolean {
  return env.locked === true
    && Object.isFrozen(env)
    && env.envelopeSignature === signObject(env.payload);
}

// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Determinism
// Replay/hash consistency. Pure & read-only.

import type { RuntimeMetaTransformation } from './metaTransformationTypes';
import { normalizeMetaTransformation } from './metaNormalization';

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
  return 'det_' + h.toString(16).padStart(8, '0');
}

export type MetaDeterminismVerdict = 'STRICT' | 'STABLE' | 'EVENTUAL' | 'UNSTABLE';

export interface MetaDeterminismReport {
  readonly verdict: MetaDeterminismVerdict;
  readonly signature: string;
  readonly replaySignature: string;
  readonly byteEquivalent: boolean;
  readonly orderingStable: boolean;
  readonly mutationLeakage: boolean;
}

export function computeMetaDeterminismSignature(t: RuntimeMetaTransformation): string {
  return hash(stableStringify(t));
}

export function isMetaTransformationDeterministic(t: RuntimeMetaTransformation): MetaDeterminismReport {
  const baseSig = computeMetaDeterminismSignature(t);
  const replay = normalizeMetaTransformation(t);
  const replaySig = computeMetaDeterminismSignature(replay);

  // Ordering stability: shuffle component view via reversed copy and re-normalize.
  const reversed: RuntimeMetaTransformation = deepFreeze({
    ...t,
    components: Object.freeze([...t.components].reverse()),
  });
  const reorderedSig = computeMetaDeterminismSignature(normalizeMetaTransformation(reversed));

  // Mutation leakage: original must remain frozen and unchanged.
  const stillFrozen = Object.isFrozen(t) && Object.isFrozen(t.components);
  const mutationLeakage = !stillFrozen;

  const orderingStable = reorderedSig === replaySig;
  const byteEquivalent = baseSig === replaySig;

  let verdict: MetaDeterminismVerdict;
  if (byteEquivalent && orderingStable && !mutationLeakage) verdict = 'STRICT';
  else if (orderingStable && !mutationLeakage) verdict = 'STABLE';
  else if (orderingStable) verdict = 'EVENTUAL';
  else verdict = 'UNSTABLE';

  const report: MetaDeterminismReport = {
    verdict,
    signature: baseSig,
    replaySignature: replaySig,
    byteEquivalent,
    orderingStable,
    mutationLeakage,
  };
  return deepFreeze(report);
}

export const __meta_determinism_internals = deepFreeze({
  stage: STAGE_0,
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
});

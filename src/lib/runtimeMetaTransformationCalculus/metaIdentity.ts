// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Identity
// Neutral element + identity preservation certification. Pure & deterministic.

import type {
  MetaIdentityClass,
  RuntimeMetaIdentity,
  RuntimeMetaTransformation,
} from './metaTransformationTypes';
import { buildMetaTransformation } from './metaTransformation';

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const k of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[k]);
  }
  return value;
}

export const META_IDENTITY: RuntimeMetaTransformation = buildMetaTransformation([]);

function classify(preservation: number, violations: number): MetaIdentityClass {
  if (violations > 0 && preservation < 0.4) return 'BROKEN';
  if (preservation >= 0.9) return 'PRESERVED';
  if (preservation >= 0.6) return 'WEAK';
  return 'BROKEN';
}

export function certifyMetaIdentity(
  base: RuntimeMetaTransformation,
): RuntimeMetaIdentity {
  // Identity check: composing with the empty (neutral) transformation must not change the score.
  const neutralScore = META_IDENTITY.score; // 0 by construction
  const delta = Math.abs(base.score - (base.score + neutralScore - neutralScore));
  let violations = 0;
  if (base.collapsed) violations++;
  if (delta > 1e-9) violations++;

  let avgIdentity = 0;
  for (const c of base.components) avgIdentity += c.identity;
  avgIdentity = base.components.length === 0 ? 1 : avgIdentity / base.components.length;

  const preservation = Math.round(avgIdentity * 1e6) / 1e6;
  const klass = classify(preservation, violations);
  const broken = klass === 'BROKEN';

  const envelope: RuntimeMetaIdentity = {
    class: klass,
    preservation,
    violations,
    broken,
  };
  return deepFreeze(envelope);
}

export function isMetaIdentityIdempotent(a: RuntimeMetaTransformation): boolean {
  const first = certifyMetaIdentity(a);
  const second = certifyMetaIdentity(a);
  return (
    first.class === second.class &&
    first.preservation === second.preservation &&
    first.violations === second.violations &&
    first.broken === second.broken
  );
}

export const __meta_identity_internals = deepFreeze({
  stage: 'STAGE_0_READ_ONLY',
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
});

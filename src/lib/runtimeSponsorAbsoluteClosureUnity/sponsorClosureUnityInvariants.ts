/**
 * Phase 1.9.39 — Sponsor Closure-Unity Invariants.
 */
import {
  SPONSOR_CLOSURE_UNITY_INVARIANTS,
  deepFreeze,
  signObject,
  type SponsorClosureUnityInvariantId,
} from './sponsorClosureUnityInternals';

export interface SponsorClosureUnityInvariant {
  readonly id: SponsorClosureUnityInvariantId;
  readonly title: string;
  readonly statement: string;
  readonly invariantSignature: string;
}

export interface SponsorClosureUnityInvariantRegistry {
  readonly version: 'v1';
  readonly invariants: ReadonlyArray<SponsorClosureUnityInvariant>;
  readonly invariantsSignature: string;
}

export function generateClosureUnityInvariants(): SponsorClosureUnityInvariantRegistry {
  const invariants: SponsorClosureUnityInvariant[] = SPONSOR_CLOSURE_UNITY_INVARIANTS.map((spec) =>
    Object.freeze({
      id: spec.id,
      title: spec.title,
      statement: spec.statement,
      invariantSignature: signObject({ id: spec.id, statement: spec.statement }),
    }),
  );
  const invariantsSignature = signObject(invariants.map((i) => i.invariantSignature));
  return deepFreeze({
    version: 'v1' as const,
    invariants: Object.freeze(invariants),
    invariantsSignature,
  });
}

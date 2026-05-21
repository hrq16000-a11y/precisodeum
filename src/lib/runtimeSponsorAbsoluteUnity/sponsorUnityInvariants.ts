/**
 * Phase 1.9.37 — Sponsor Unity Invariants.
 */
import {
  SPONSOR_UNITY_INVARIANTS,
  deepFreeze,
  signObject,
  type SponsorUnityInvariantId,
} from './sponsorUnityInternals';

export interface SponsorUnityInvariant {
  readonly id: SponsorUnityInvariantId;
  readonly title: string;
  readonly statement: string;
  readonly invariantSignature: string;
}

export interface SponsorUnityInvariantRegistry {
  readonly version: 'v1';
  readonly invariants: ReadonlyArray<SponsorUnityInvariant>;
  readonly invariantsSignature: string;
}

export function generateUnityInvariants(): SponsorUnityInvariantRegistry {
  const invariants: SponsorUnityInvariant[] = SPONSOR_UNITY_INVARIANTS.map((spec) =>
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

/**
 * Phase 1.9.38 — Sponsor Reflexivity Invariants.
 */
import {
  SPONSOR_REFLEXIVITY_INVARIANTS,
  deepFreeze,
  signObject,
  type SponsorReflexivityInvariantId,
} from './sponsorReflexivityInternals';

export interface SponsorReflexivityInvariant {
  readonly id: SponsorReflexivityInvariantId;
  readonly title: string;
  readonly statement: string;
  readonly invariantSignature: string;
}

export interface SponsorReflexivityInvariantRegistry {
  readonly version: 'v1';
  readonly invariants: ReadonlyArray<SponsorReflexivityInvariant>;
  readonly invariantsSignature: string;
}

export function generateReflexivityInvariants(): SponsorReflexivityInvariantRegistry {
  const invariants: SponsorReflexivityInvariant[] = SPONSOR_REFLEXIVITY_INVARIANTS.map((spec) =>
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

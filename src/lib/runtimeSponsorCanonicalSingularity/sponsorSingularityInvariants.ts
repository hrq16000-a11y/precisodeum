/**
 * Phase 1.9.41 — Sponsor Singularity Invariants.
 */
import {
  SPONSOR_SINGULARITY_INVARIANTS,
  deepFreeze,
  signObject,
  type SponsorSingularityInvariantId,
} from './sponsorSingularityInternals';

export interface SponsorSingularityInvariant {
  readonly id: SponsorSingularityInvariantId;
  readonly title: string;
  readonly statement: string;
  readonly invariantSignature: string;
}

export interface SponsorSingularityInvariantRegistry {
  readonly version: 'v1';
  readonly invariants: ReadonlyArray<SponsorSingularityInvariant>;
  readonly invariantsSignature: string;
}

export function generateSingularityInvariants(): SponsorSingularityInvariantRegistry {
  const invariants: SponsorSingularityInvariant[] = SPONSOR_SINGULARITY_INVARIANTS.map((spec) =>
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

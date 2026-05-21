/**
 * Phase 1.9.35 — Sponsor Coherence Invariants.
 */
import {
  SPONSOR_COHERENCE_INVARIANTS,
  deepFreeze,
  signObject,
  type SponsorCoherenceInvariantId,
} from './sponsorCoherenceInternals';

export interface SponsorCoherenceInvariant {
  readonly id: SponsorCoherenceInvariantId;
  readonly title: string;
  readonly statement: string;
  readonly invariantSignature: string;
}

export interface SponsorCoherenceInvariantRegistry {
  readonly version: 'v1';
  readonly invariants: ReadonlyArray<SponsorCoherenceInvariant>;
  readonly invariantsSignature: string;
}

export function generateCoherenceInvariants(): SponsorCoherenceInvariantRegistry {
  const invariants: SponsorCoherenceInvariant[] = SPONSOR_COHERENCE_INVARIANTS.map((spec) =>
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

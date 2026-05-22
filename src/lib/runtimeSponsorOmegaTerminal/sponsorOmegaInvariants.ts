/**
 * Phase 1.9.40 — Sponsor Omega Invariants.
 */
import {
  SPONSOR_OMEGA_INVARIANTS,
  deepFreeze,
  signObject,
  type SponsorOmegaInvariantId,
} from './sponsorOmegaInternals';

export interface SponsorOmegaInvariant {
  readonly id: SponsorOmegaInvariantId;
  readonly title: string;
  readonly statement: string;
  readonly invariantSignature: string;
}

export interface SponsorOmegaInvariantRegistry {
  readonly version: 'v1';
  readonly invariants: ReadonlyArray<SponsorOmegaInvariant>;
  readonly invariantsSignature: string;
}

export function generateOmegaInvariants(): SponsorOmegaInvariantRegistry {
  const invariants: SponsorOmegaInvariant[] = SPONSOR_OMEGA_INVARIANTS.map((spec) =>
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

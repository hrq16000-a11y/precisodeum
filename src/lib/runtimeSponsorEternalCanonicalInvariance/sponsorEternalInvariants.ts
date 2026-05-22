/**
 * Phase 1.9.42 — Sponsor Eternal Invariants.
 */
import {
  SPONSOR_ETERNAL_INVARIANTS,
  deepFreeze,
  signObject,
  type SponsorEternalInvariantId,
} from './sponsorEternalInternals';

export interface SponsorEternalInvariant {
  readonly id: SponsorEternalInvariantId;
  readonly title: string;
  readonly statement: string;
  readonly invariantSignature: string;
}

export interface SponsorEternalInvariantRegistry {
  readonly version: 'v1';
  readonly invariants: ReadonlyArray<SponsorEternalInvariant>;
  readonly invariantsSignature: string;
}

export function generateEternalInvariants(): SponsorEternalInvariantRegistry {
  const invariants: SponsorEternalInvariant[] = SPONSOR_ETERNAL_INVARIANTS.map((s) =>
    Object.freeze({
      id: s.id,
      title: s.title,
      statement: s.statement,
      invariantSignature: signObject({ id: s.id, statement: s.statement }),
    }),
  );
  const invariantsSignature = signObject(invariants.map((i) => i.invariantSignature));
  return deepFreeze({
    version: 'v1' as const,
    invariants: Object.freeze(invariants),
    invariantsSignature,
  });
}

/**
 * Phase 1.9.44 — Sponsor Infinity Invariants.
 */
import {
  SPONSOR_INFINITY_INVARIANTS,
  deepFreeze,
  signObject,
  type SponsorInfinityInvariantId,
} from './sponsorInfinityInternals';

export interface SponsorInfinityInvariant {
  readonly id: SponsorInfinityInvariantId;
  readonly title: string;
  readonly statement: string;
  readonly invariantSignature: string;
}

export interface SponsorInfinityInvariantRegistry {
  readonly version: 'v1';
  readonly invariants: ReadonlyArray<SponsorInfinityInvariant>;
  readonly invariantsSignature: string;
}

export function generateInfinityInvariants(): SponsorInfinityInvariantRegistry {
  const invariants: SponsorInfinityInvariant[] = SPONSOR_INFINITY_INVARIANTS.map((s) =>
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

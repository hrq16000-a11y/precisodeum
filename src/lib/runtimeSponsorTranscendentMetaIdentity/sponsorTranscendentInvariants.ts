/**
 * Phase 1.9.43 — Sponsor Transcendent Invariants.
 */
import {
  SPONSOR_TRANSCENDENT_INVARIANTS,
  deepFreeze,
  signObject,
  type SponsorTranscendentInvariantId,
} from './sponsorTranscendentInternals';

export interface SponsorTranscendentInvariant {
  readonly id: SponsorTranscendentInvariantId;
  readonly title: string;
  readonly statement: string;
  readonly invariantSignature: string;
}

export interface SponsorTranscendentInvariantRegistry {
  readonly version: 'v1';
  readonly invariants: ReadonlyArray<SponsorTranscendentInvariant>;
  readonly invariantsSignature: string;
}

export function generateTranscendentInvariants(): SponsorTranscendentInvariantRegistry {
  const invariants: SponsorTranscendentInvariant[] = SPONSOR_TRANSCENDENT_INVARIANTS.map((s) =>
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

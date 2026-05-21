/**
 * Phase 1.9.34 — Sponsor Existence Invariants.
 */
import {
  SPONSOR_EXISTENCE_INVARIANTS,
  deepFreeze,
  signObject,
  type SponsorExistenceInvariantId,
} from './sponsorExistenceInternals';
import type { SponsorAbsoluteIdentity } from './sponsorAbsoluteIdentity';

export interface SponsorExistenceInvariant {
  readonly id: SponsorExistenceInvariantId;
  readonly title: string;
  readonly statement: string;
  readonly verdict: 'satisfied';
  readonly invariantSignature: string;
}

export interface SponsorExistenceInvariantRegistry {
  readonly version: 'v1';
  readonly invariants: ReadonlyArray<SponsorExistenceInvariant>;
  readonly invariantsSignature: string;
}

export function buildExistenceInvariants(
  identity: SponsorAbsoluteIdentity,
): SponsorExistenceInvariantRegistry {
  const invariants: SponsorExistenceInvariant[] = SPONSOR_EXISTENCE_INVARIANTS.map((spec) =>
    Object.freeze({
      id: spec.id,
      title: spec.title,
      statement: spec.statement,
      verdict: 'satisfied' as const,
      invariantSignature: signObject({
        id: spec.id,
        statement: spec.statement,
        identity: identity.identitySignature,
      }),
    }),
  );
  const invariantsSignature = signObject(invariants.map((i) => i.invariantSignature));
  return deepFreeze({
    version: 'v1' as const,
    invariants: Object.freeze(invariants),
    invariantsSignature,
  });
}

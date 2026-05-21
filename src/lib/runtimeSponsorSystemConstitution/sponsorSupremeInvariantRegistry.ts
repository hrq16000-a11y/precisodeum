/**
 * Phase 1.9.31 — Sponsor Supreme Invariant Registry.
 * Deterministic registry of supreme invariants bound to axioms.
 */
import {
  SPONSOR_SUPREME_INVARIANTS,
  deepFreeze,
  signObject,
  type SponsorConstitutionalAxiomId,
  type SponsorSupremeInvariantId,
} from './sponsorConstitutionInternals';

export interface SponsorSupremeInvariant {
  readonly id: SponsorSupremeInvariantId;
  readonly axiom: SponsorConstitutionalAxiomId;
  readonly description: string;
  readonly invariantSignature: string;
}

export interface SponsorSupremeInvariantRegistry {
  readonly version: 'v1';
  readonly invariants: ReadonlyArray<SponsorSupremeInvariant>;
  readonly invariantsSignature: string;
}

export function buildSupremeInvariantRegistry(): SponsorSupremeInvariantRegistry {
  const invariants: SponsorSupremeInvariant[] = SPONSOR_SUPREME_INVARIANTS.map((i) =>
    Object.freeze({
      id: i.id,
      axiom: i.axiom,
      description: i.description,
      invariantSignature: signObject({ id: i.id, axiom: i.axiom, description: i.description }),
    }),
  );
  const invariantsSignature = signObject(invariants.map((i) => i.invariantSignature));
  return deepFreeze({
    version: 'v1' as const,
    invariants: Object.freeze(invariants),
    invariantsSignature,
  });
}

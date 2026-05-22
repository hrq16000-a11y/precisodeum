/**
 * Operational Certification Registry — registro de certificação operacional.
 */
import { SPONSOR_FINAL_CERTIFICATION_INTERNALS } from './sponsorFinalCertificationInternals';

export interface OperationalCertificationEntry {
  readonly layer: string;
  readonly certified: true;
  readonly realActivationAuthorized: false;
}

export function buildOperationalCertificationRegistry(): readonly OperationalCertificationEntry[] {
  return Object.freeze(
    SPONSOR_FINAL_CERTIFICATION_INTERNALS.consumes.map((layer) =>
      Object.freeze({
        layer,
        certified: true as const,
        realActivationAuthorized: false as const,
      }),
    ),
  );
}

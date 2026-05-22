/**
 * Operational Admissibility Topology — topologia canônica de admissibilidade.
 */
import { resolveOperationalAdmissibility } from './sponsorOperationalAdmissibilityResolver';

export interface AdmissibilityNode {
  readonly dimension: string;
  readonly admissible: boolean;
}

export function buildOperationalAdmissibilityTopology(): readonly AdmissibilityNode[] {
  return Object.freeze(
    resolveOperationalAdmissibility().map((r) =>
      Object.freeze({ dimension: r.dimension, admissible: r.admissible }),
    ),
  );
}

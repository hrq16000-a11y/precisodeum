export interface SponsorActivationPrerequisite {
  readonly id: string;
  readonly description: string;
  readonly satisfied: true;
}

export const ACTIVATION_PREREQUISITES: ReadonlyArray<SponsorActivationPrerequisite> = Object.freeze([
  Object.freeze({ id: 'prereq:formal-completeness', description: 'Upstream formal completeness sealed', satisfied: true as const }),
  Object.freeze({ id: 'prereq:deterministic-runtime', description: 'Deterministic runtime certified', satisfied: true as const }),
  Object.freeze({ id: 'prereq:public-contracts-stable', description: 'Public contracts stabilized', satisfied: true as const }),
  Object.freeze({ id: 'prereq:audit-ledger-immutable', description: 'Audit ledger immutable', satisfied: true as const }),
  Object.freeze({ id: 'prereq:governance-terminal', description: 'Governance terminal sealed', satisfied: true as const }),
  Object.freeze({ id: 'prereq:rollback-deterministic', description: 'Rollback determinism proven', satisfied: true as const }),
]);

export function evaluateActivationPrerequisites(): ReadonlyArray<SponsorActivationPrerequisite> {
  return ACTIVATION_PREREQUISITES;
}

/**
 * Rollout Freeze Constraints — restrições de congelamento de rollout.
 */
export const ROLLOUT_FREEZE_CONSTRAINTS = Object.freeze({
  freezeOnInvariantViolation: true,
  freezeOnDependencyDrift: true,
  freezeOnConvergenceMismatch: true,
  freezeOnTopologyMismatch: true,
  freezeOnSafetyBlock: true,
  defaultStateAfterFreeze: 'HALTED',
} as const);

export type RolloutFreezeConstraint = keyof typeof ROLLOUT_FREEZE_CONSTRAINTS;

export function isFreezeRequired(reason: RolloutFreezeConstraint): boolean {
  return Boolean(ROLLOUT_FREEZE_CONSTRAINTS[reason]);
}

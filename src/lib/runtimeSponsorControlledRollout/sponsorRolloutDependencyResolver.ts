/**
 * Rollout Dependency Resolver — resolve dependências entre stages.
 */
import { ROLLOUT_STAGE_ORDER, type RolloutStage } from './sponsorRolloutOrchestrationRuntime';

export interface RolloutDependency {
  readonly stage: RolloutStage;
  readonly requires: readonly RolloutStage[];
}

export function resolveRolloutDependencies(): readonly RolloutDependency[] {
  const deps: RolloutDependency[] = ROLLOUT_STAGE_ORDER.map((stage, i) =>
    Object.freeze({
      stage,
      requires: Object.freeze(ROLLOUT_STAGE_ORDER.slice(0, i)) as readonly RolloutStage[],
    }),
  );
  return Object.freeze(deps);
}

export function assertNoDependencyDrift(deps: readonly RolloutDependency[]): void {
  for (const d of deps) {
    const idx = ROLLOUT_STAGE_ORDER.indexOf(d.stage);
    if (d.requires.length !== idx) {
      throw new Error('ROLLOUT_DEPENDENCY_DRIFT');
    }
  }
}

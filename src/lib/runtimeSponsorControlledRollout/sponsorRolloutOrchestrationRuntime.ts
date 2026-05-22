/**
 * Rollout Orchestration Runtime — coordena stages de rollout simulado.
 * 100% determinístico e read-only.
 */
import { SPONSOR_ROLLOUT_INTERNALS } from './sponsorRolloutInternals';

export type RolloutStage =
  | 'dark_launch'
  | 'internal_dogfood'
  | 'closed_beta'
  | 'open_beta'
  | 'partial_ga'
  | 'general_availability';

export const ROLLOUT_STAGE_ORDER: readonly RolloutStage[] = Object.freeze([
  'dark_launch',
  'internal_dogfood',
  'closed_beta',
  'open_beta',
  'partial_ga',
  'general_availability',
]);

export interface RolloutStageOutcome {
  readonly stage: RolloutStage;
  readonly index: number;
  readonly exposurePct: number;
  readonly allowed: boolean;
  readonly reason: string;
}

const EXPOSURE_MAP: Readonly<Record<RolloutStage, number>> = Object.freeze({
  dark_launch: 0,
  internal_dogfood: 1,
  closed_beta: 5,
  open_beta: 20,
  partial_ga: 50,
  general_availability: 100,
});

export function orchestrateRolloutStages(): readonly RolloutStageOutcome[] {
  const out: RolloutStageOutcome[] = ROLLOUT_STAGE_ORDER.map((stage, i) =>
    Object.freeze({
      stage,
      index: i,
      exposurePct: EXPOSURE_MAP[stage],
      allowed: false, // fail-closed: orquestrador simula, nunca autoriza
      reason: 'SIMULATION_ONLY_NO_REAL_EXPOSURE',
    }),
  );
  return Object.freeze(out);
}

export function coordinateExposureProgression(): readonly RolloutStageOutcome[] {
  const stages = orchestrateRolloutStages();
  // Verifica monotonicidade não-decrescente da exposição.
  for (let i = 1; i < stages.length; i++) {
    if (stages[i].exposurePct < stages[i - 1].exposurePct) {
      throw new Error('ROLLOUT_EXPOSURE_REGRESSION_DETECTED');
    }
  }
  return stages;
}

export const ORCHESTRATION_RUNTIME_TAG = Object.freeze({
  phase: SPONSOR_ROLLOUT_INTERNALS.phase,
  runtime: 'ROLLOUT_ORCHESTRATION_RUNTIME',
});

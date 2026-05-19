/**
 * Fase 1.7.10 — Explainers (PURE strings).
 */

import type {
  AtomicPilotCandidate,
  PilotAbortStrategy,
  PilotKillSwitchPolicy,
  PilotRolloutStrategy,
} from './pilotTypes';
import type { PilotReadinessReport } from './pilotReadiness';

export function explainPilotCandidate(c: AtomicPilotCandidate): string {
  return `[PILOT/${c.eligibility}] ${c.flow} stage=${c.recommendedStage} risk=${c.risk} blast=${c.blast} parity=${c.parityScore} rollback=${c.rollback} blockers=${c.blockerCount}`;
}

export function explainPilotReadiness(r: PilotReadinessReport): string {
  return `[PILOT/READY] ${r.flow} eligibility=${r.eligibility} score=${r.readinessScore} confidence=${r.confidence} blockers=${r.blockers.length} promotion=${r.pilotPromotionSupported}`;
}

export function explainRolloutStrategy(s: PilotRolloutStrategy): string {
  return `[PILOT/ROLLOUT] ${s.flow} policy=${s.policy} pct=${s.percentage} cohorts=${s.cohorts.length} progressive=${s.progressiveExposure} drift=${s.driftTolerance}`;
}

export function explainAbortStrategy(a: PilotAbortStrategy): string {
  return `[PILOT/ABORT] ${a.flow} immediate=${a.immediate} graceful=${a.graceful} fallback=${a.shadowFallback} mirrorDisable=${a.mirrorDisable} freeze=${a.pilotFreeze} triggers=${a.triggers.length}`;
}

export function explainKillSwitch(k: PilotKillSwitchPolicy): string {
  return `[PILOT/KILL] ${k.flow} sensitivity=${k.sensitivity} triggers=${k.triggers.length} auto=${k.autoEngage}`;
}

/**
 * Fase 1.7.11 — Release windows (READ-ONLY).
 *
 * Declarative classification of WHICH change classes are admissible on a
 * given flow. Nothing is gated in runtime — these are advisory contracts.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import { detectReleaseFreeze, classifyReleaseRisk } from './releaseFreezePolicies';
import type {
  GovernanceChangeClass,
  GovernanceReleaseWindow,
  GovernanceReleaseWindowState,
} from './governanceTypes';

const ALL_CHANGE_CLASSES: GovernanceChangeClass[] = [
  'observability_only',
  'shadow_compare',
  'cohort_expansion',
  'stage_promotion',
  'rollback_strategy_change',
  'kill_switch_change',
  'freeze_override',
];

export function buildReleaseWindowPolicy(flow: FlowId): GovernanceReleaseWindow {
  const freeze = detectReleaseFreeze(flow);
  const risk = classifyReleaseRisk(flow);

  let state: GovernanceReleaseWindowState = 'open';
  if (freeze.level === 'HARD_FREEZE' || freeze.level === 'GLOBAL_FREEZE') {
    state = 'frozen';
  } else if (freeze.level === 'PARTIAL_FREEZE') {
    state = 'closed';
  } else if (freeze.level === 'SOFT_FREEZE' || risk?.risk === 'HIGH') {
    state = 'restricted';
  }

  const blocked: string[] = [];
  let allowed: GovernanceChangeClass[];
  switch (state) {
    case 'frozen':
      allowed = ['observability_only', 'freeze_override'];
      blocked.push('promotion_blocked_by_hard_freeze');
      break;
    case 'closed':
      allowed = ['observability_only', 'shadow_compare', 'kill_switch_change'];
      blocked.push('promotion_blocked_by_partial_freeze');
      break;
    case 'restricted':
      allowed = [
        'observability_only',
        'shadow_compare',
        'kill_switch_change',
        'rollback_strategy_change',
      ];
      blocked.push('limited_to_safe_change_classes');
      break;
    default:
      allowed = ALL_CHANGE_CLASSES.filter((c) => c !== 'freeze_override');
  }

  return {
    flow,
    state,
    blockedReasons: blocked,
    allowedChangeClasses: allowed,
    freezeLevel: freeze.level,
  };
}

export function detectBlockedReleaseWindow(flow: FlowId): boolean {
  const w = buildReleaseWindowPolicy(flow);
  return w.state === 'frozen' || w.state === 'closed';
}

export function explainReleaseWindow(w: GovernanceReleaseWindow): string {
  return `[WINDOW/${w.state}] ${w.flow} freeze=${w.freezeLevel} allowed=${w.allowedChangeClasses.join(',')}`;
}

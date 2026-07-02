/**
 * Fase 1.7.6 — Pure string explainers (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  BlueprintViolation,
  OperationBlueprint,
} from './atomicBlueprintTypes';

export function explainBlueprint(bp: OperationBlueprint): string {
  return [
    `flow=${bp.flow}`,
    `feasibility=${bp.transactional_feasibility}`,
    `complexity=${bp.migration_complexity}`,
    `blast_radius=${bp.blast_radius}`,
    `rollback=${bp.rollback_requirements.join('|')}`,
    `consistency=${bp.consistency_requirements.join('|')}`,
    `rpc=${bp.recommended_rpc.name}`,
    `steps=${bp.current_write_order.join('>')}`,
  ].join(' ');
}

export function explainViolation(v: BlueprintViolation): string {
  const parts = [`code=${v.code}`];
  if (v.flow) parts.push(`flow=${v.flow}`);
  if (v.stage) parts.push(`stage=${v.stage}`);
  parts.push(`detail=${v.detail}`);
  return parts.join(' ');
}

export function explainFlowSummary(flow: FlowId, bp: OperationBlueprint | null): string {
  if (!bp) return `flow=${flow} blueprint=missing`;
  return explainBlueprint(bp);
}

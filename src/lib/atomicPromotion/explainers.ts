/**
 * Fase 1.7.8 — Promotion explainers (PURE strings).
 */

import type {
  PromotionBlocker,
  PromotionConfidence,
  PromotionFlowState,
  PromotionRisk,
  PromotionStageId,
} from './promotionTypes';

export function explainPromotionDecision(s: PromotionFlowState): string {
  return `[PROMOTE/${s.decision}] ${s.flow} current=${s.currentStage} max=${s.maxAllowedStage} conf=${s.confidence} risk=${s.risk} rollback=${s.rollbackClass} parity=${s.parityScore} blockers=${s.blockers.length}`;
}

export function explainPromotionBlockers(blockers: PromotionBlocker[]): string {
  if (blockers.length === 0) return 'no blockers';
  return blockers.map((b) => `${b.code}(${b.severity})`).join(',');
}

export function explainPromotionConfidence(c: PromotionConfidence): string {
  return `confidence=${c}`;
}

export function explainPromotionStage(id: PromotionStageId): string {
  return `stage=${id}`;
}

export function explainPromotionRisk(r: PromotionRisk): string {
  return `risk=${r}`;
}

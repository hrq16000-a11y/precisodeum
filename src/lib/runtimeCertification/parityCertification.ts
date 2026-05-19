/**
 * Fase 1.7.12 — Parity certification (READ-ONLY).
 */

import { type FlowId } from '@/lib/operations/operationRegistry';
import { compareLegacyVsAtomic } from '@/lib/atomicSimulation/executionParity';
import type { PromotionConfidence } from '@/lib/atomicPromotion/promotionTypes';
import type {
  RuntimeCertificationLevel,
  RuntimeParityCertification,
} from './certificationTypes';

function confidenceOf(score: number): PromotionConfidence {
  if (score >= 95) return 'VERY_HIGH';
  if (score >= 85) return 'HIGH';
  if (score >= 70) return 'MODERATE';
  if (score >= 50) return 'LOW';
  return 'NONE';
}

function levelOf(score: number, regressions: number): RuntimeCertificationLevel {
  if (regressions > 2) return 'NONE';
  if (score >= 95 && regressions === 0) return 'FULL';
  if (score >= 85) return 'CONDITIONAL';
  if (score >= 70) return 'LIMITED';
  return 'NONE';
}

export function certifyParityConfidence(flow: FlowId): PromotionConfidence {
  const p = compareLegacyVsAtomic(flow);
  return confidenceOf(p?.score ?? 0);
}

export function detectParityInstability(flow: FlowId): boolean {
  const p = compareLegacyVsAtomic(flow);
  if (!p) return true;
  return p.regressions.length > 1 || p.score < 70;
}

export function detectRollbackParityMismatch(flow: FlowId): boolean {
  const p = compareLegacyVsAtomic(flow);
  if (!p) return true;
  return !p.rollbackParity;
}

export function calculateParityCertification(
  flow: FlowId,
): RuntimeParityCertification {
  const p = compareLegacyVsAtomic(flow);
  const score = p?.score ?? 0;
  const regressions = p?.regressions ?? [];
  return {
    flow,
    score,
    confidence: confidenceOf(score),
    stable: !detectParityInstability(flow),
    regressions,
    rollbackParityOk: !!p?.rollbackParity,
    level: levelOf(score, regressions.length),
  };
}

export function explainParityCertification(c: RuntimeParityCertification): string {
  return `[CERT/PARITY] ${c.flow} score=${c.score} confidence=${c.confidence} level=${c.level} stable=${c.stable} regressions=${c.regressions.length} rollbackParity=${c.rollbackParityOk}`;
}

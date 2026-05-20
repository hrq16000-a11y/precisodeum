/**
 * Fase 1.8.0 — Runtime ↔ Simulation/Blueprint/Certification/Governance/Promotion
 * comparison helpers (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import { simulateAtomicExecution } from '@/lib/atomicSimulation/simulateAtomicExecution';
import { buildRuntimeCertification } from '@/lib/runtimeCertification/certificationMatrix';
import { buildGovernanceState } from '@/lib/atomicGovernance/governanceMatrix';
import { calculatePromotionEligibility } from '@/lib/atomicPromotion/promotionEligibility';
import type { RuntimeWriteTrace } from './recorderTypes';

export interface RuntimeParityGap {
  flow: FlowId;
  gap: number; // 0..100, higher = worse
  reasons: string[];
}

export function compareRuntimeToSimulation(trace: RuntimeWriteTrace) {
  const sim = simulateAtomicExecution(trace.flow);
  const expectedOrder = sim.plan.steps.map((s) => s.step);
  const actualOrder = trace.ordering.actualOrder;
  const orderMatches =
    expectedOrder.length === actualOrder.length &&
    expectedOrder.every((s, i) => s === actualOrder[i]);
  return {
    flow: trace.flow,
    orderMatches,
    consistency: trace.consistency,
    severity: trace.severity,
    blast: sim.blast,
  };
}

export function compareRuntimeToBlueprint(trace: RuntimeWriteTrace) {
  const sim = simulateAtomicExecution(trace.flow);
  const blueprintAtomic = sim.plan.steps.every((s) => s.atomic);
  return {
    flow: trace.flow,
    blueprintAtomic,
    runtimeClassification: trace.classification,
    compatible:
      blueprintAtomic &&
      (trace.classification === 'SAFE' || trace.classification === 'EVENTUAL'),
  };
}

export function compareRuntimeToCertification(trace: RuntimeWriteTrace) {
  const cert = buildRuntimeCertification(trace.flow);
  return {
    flow: trace.flow,
    certificationLevel: cert.level,
    runtimeClassification: trace.classification,
    safe:
      cert.level !== 'NONE' &&
      trace.classification !== 'CRITICAL' &&
      trace.classification !== 'DIVERGENT' &&
      trace.classification !== 'ORPHAN_RISK',
  };
}

export function compareRuntimeToGovernance(trace: RuntimeWriteTrace) {
  const gov = buildGovernanceState(trace.flow);
  return {
    flow: trace.flow,
    decision: gov.decision,
    freeze: gov.freeze,
    runtimeClassification: trace.classification,
    aligned:
      !(gov.freeze === 'HARD_FREEZE' && trace.classification === 'CRITICAL'),
  };
}

export function compareRuntimeToPromotion(trace: RuntimeWriteTrace) {
  const elig = calculatePromotionEligibility(trace.flow);
  return {
    flow: trace.flow,
    promotionEligible: elig.eligible,
    runtimeClassification: trace.classification,
  };
}

export function calculateRuntimeParityGap(
  trace: RuntimeWriteTrace,
): RuntimeParityGap {
  const reasons: string[] = [];
  let gap = 0;
  const sim = compareRuntimeToSimulation(trace);
  if (!sim.orderMatches) {
    gap += 30;
    reasons.push('order_mismatch');
  }
  if (trace.consistency === 'inconsistent') {
    gap += 30;
    reasons.push('consistency_inconsistent');
  } else if (trace.consistency === 'partial' || trace.consistency === 'orphaned') {
    gap += 20;
    reasons.push(`consistency_${trace.consistency}`);
  }
  if (trace.classification === 'CRITICAL') {
    gap += 40;
    reasons.push('classification_critical');
  } else if (
    trace.classification === 'DIVERGENT' ||
    trace.classification === 'ORPHAN_RISK' ||
    trace.classification === 'MIRROR_DEPENDENT'
  ) {
    gap += 25;
    reasons.push(`classification_${trace.classification.toLowerCase()}`);
  }
  if (trace.severity === 'CRITICAL') {
    gap += 20;
    reasons.push('severity_critical');
  } else if (trace.severity === 'HIGH') {
    gap += 10;
    reasons.push('severity_high');
  }
  if (gap > 100) gap = 100;
  return { flow: trace.flow, gap, reasons };
}

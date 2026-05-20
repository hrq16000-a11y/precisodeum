/**
 * Fase 1.8.5 — Integrity envelope (READ-ONLY, pure).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  IntegrityClassification,
  IntegrityRisk,
  RuntimeIntegrityContainment,
  RuntimeIntegrityEnvelope,
  RuntimeIntegrityIsolation,
  RuntimeIntegrityPropagation,
  RuntimeIntegrityTopology,
  RuntimeIntegrityWindow,
} from './integrityTypes';

export interface BuildEnvelopeInput {
  readonly flow: FlowId;
  readonly topology: RuntimeIntegrityTopology;
  readonly containment: readonly RuntimeIntegrityContainment[];
  readonly isolation: RuntimeIntegrityIsolation;
  readonly propagation: readonly RuntimeIntegrityPropagation[];
  readonly window: RuntimeIntegrityWindow;
}

export function calculateIntegrityScore(input: BuildEnvelopeInput): number {
  let score = 1;
  score -= Math.min(0.4, input.topology.gapCount * 0.1);
  if (input.topology.recursive) score -= 0.2;
  if (input.topology.leaking) score -= 0.15;
  for (const c of input.containment) {
    if (c.containment === 'partially_contained') score -= 0.05;
    if (c.containment === 'leaking') score -= 0.1;
    if (c.containment === 'cascading') score -= 0.2;
    if (c.containment === 'unbounded') score -= 0.3;
  }
  switch (input.isolation.isolation) {
    case 'boundary_shared': score -= 0.1; break;
    case 'mirror_exposed': score -= 0.15; break;
    case 'replay_exposed': score -= 0.2; break;
    case 'globally_exposed': score -= 0.4; break;
  }
  for (const p of input.propagation) {
    if (p.leaking) score -= 0.03;
    if (p.recursive) score -= 0.05;
    if (p.circular) score -= 0.1;
  }
  if (score < 0) score = 0;
  if (score > 1) score = 1;
  return Math.round(score * 100) / 100;
}

export function classifyIntegrityEnvelope(input: {
  score: number;
  cascading: boolean;
  unbounded: boolean;
  globallyExposed: boolean;
}): IntegrityClassification {
  if (input.unbounded || input.globallyExposed) return 'collapsed';
  if (input.cascading) return 'compromised';
  if (input.score >= 0.85) return 'intact';
  if (input.score >= 0.6) return 'degraded';
  return 'unstable';
}

export function scoreToRisk(score: number): IntegrityRisk {
  if (score >= 0.85) return 'none';
  if (score >= 0.7) return 'low';
  if (score >= 0.5) return 'medium';
  if (score >= 0.3) return 'high';
  return 'critical';
}

export function detectIntegrityRegression(prev: number, current: number): boolean {
  return current < prev - 0.1;
}
export function detectIntegrityCollapse(e: RuntimeIntegrityEnvelope): boolean {
  return e.classification === 'collapsed';
}
export function detectIsolationFailure(i: RuntimeIntegrityIsolation): boolean {
  return !i.boundariesIntact;
}
export function detectContainmentFailure(c: readonly RuntimeIntegrityContainment[]): boolean {
  return c.some((x) => x.containment === 'unbounded' || x.containment === 'cascading');
}
export function detectCrossLayerLeak(t: RuntimeIntegrityTopology): boolean {
  return t.boundaries.some((b) => !b.intact);
}

export function buildIntegrityEnvelope(input: BuildEnvelopeInput): RuntimeIntegrityEnvelope {
  const score = calculateIntegrityScore(input);
  const cascading = input.containment.some((c) => c.containment === 'cascading');
  const unbounded = input.containment.some((c) => c.containment === 'unbounded');
  const globallyExposed = input.isolation.isolation === 'globally_exposed';
  const classification = classifyIntegrityEnvelope({ score, cascading, unbounded, globallyExposed });
  const risk = scoreToRisk(score);
  return {
    flow: input.flow,
    classification,
    score,
    risk,
    topology: input.topology,
    containment: input.containment,
    isolation: input.isolation,
    propagation: input.propagation,
    window: input.window,
    liveExecutionEnabled: false,
    retryEnabled: false,
    backgroundEnabled: false,
    realUsersAllowed: false,
    currentStage: 'STAGE_0_READ_ONLY',
  };
}

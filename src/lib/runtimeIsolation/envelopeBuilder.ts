/**
 * Fase 1.8.6 — Isolation envelope builder (READ-ONLY, pure).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  IsolationClassification,
  IsolationEnvelope,
  IsolationLeak,
  IsolationPropagation,
  IsolationSeverity,
  IsolationTopology,
} from './isolationTypes';
import { classifyBoundaryIsolation, detectIsolationCollapse } from './boundaryIsolation';

const SEVERITY_RANK: Record<IsolationSeverity, number> = {
  NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4,
};

export interface BuildIsolationEnvelopeInput {
  readonly flow: FlowId;
  readonly topology: IsolationTopology;
  readonly leaks: readonly IsolationLeak[];
  readonly propagation: IsolationPropagation;
  readonly liveExecutionEnabled?: boolean;
  readonly currentStage?: string;
}

export function calculateIsolationScore(input: {
  topology: IsolationTopology;
  leaks: readonly IsolationLeak[];
  propagation: IsolationPropagation;
}): number {
  let score = 1;
  score -= Math.min(0.3, input.topology.overlaps * 0.05);
  if (input.topology.recursive) score -= 0.2;
  if (input.topology.unsafeCoupling) score -= 0.2;
  for (const l of input.leaks) {
    const w = SEVERITY_RANK[l.severity];
    score -= w * 0.05;
  }
  if (input.propagation.classification === 'shared') score -= 0.1;
  if (input.propagation.classification === 'leaking') score -= 0.2;
  if (input.propagation.classification === 'collapsed') score -= 0.4;
  if (input.propagation.unbounded) score -= 0.15;
  if (input.propagation.hiddenCascade) score -= 0.1;
  if (score < 0) score = 0;
  if (score > 1) score = 1;
  return Math.round(score * 100) / 100;
}

export function calculateIsolationSeverity(leaks: readonly IsolationLeak[]): IsolationSeverity {
  let worst: IsolationSeverity = 'NONE';
  for (const l of leaks) {
    if (SEVERITY_RANK[l.severity] > SEVERITY_RANK[worst]) worst = l.severity;
  }
  return worst;
}

export function buildIsolationEnvelope(input: BuildIsolationEnvelopeInput): IsolationEnvelope {
  const score = calculateIsolationScore({
    topology: input.topology,
    leaks: input.leaks,
    propagation: input.propagation,
  });
  const cascading = input.propagation.classification === 'collapsed' || input.propagation.unbounded;
  const collapsed = detectIsolationCollapse({
    recursive: input.topology.recursive,
    cascading,
    liveExecutionEnabled: input.liveExecutionEnabled,
  });
  let classification: IsolationClassification = classifyBoundaryIsolation({
    boundaries: input.topology.boundaries,
    recursive: input.topology.recursive,
    cascading,
    liveExecutionEnabled: input.liveExecutionEnabled,
    currentStage: input.currentStage,
  });
  if (collapsed) classification = 'COLLAPSED';
  // Propagation override quando claramente leaking
  if (input.propagation.classification === 'leaking' && classification !== 'COLLAPSED') {
    classification = 'LEAKING';
  }
  const severity = calculateIsolationSeverity(input.leaks);
  return {
    flow: input.flow,
    classification,
    severity,
    score,
    topology: input.topology,
    leaks: input.leaks,
    propagation: input.propagation,
    liveExecutionEnabled: false,
    retryEnabled: false,
    backgroundEnabled: false,
    realUsersAllowed: false,
    currentStage: 'STAGE_0_READ_ONLY',
  };
}

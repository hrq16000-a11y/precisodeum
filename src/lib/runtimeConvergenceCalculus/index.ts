/**
 * Fase 1.9.2 — Runtime Convergence Calculus public API (READ-ONLY).
 */

import {
  buildConvergenceSpace,
  type RawConvergenceNodeInput,
} from './convergenceSpace';
import {
  resolveAllFixedPoints,
} from './fixedPointLattice';
import {
  classifyResolutionStability,
} from './resolutionConvergence';
import { buildStabilityEnvelope } from './stabilityEnvelope';
import { buildMonotonicResolution } from './monotonicResolution';
import { buildSaturationEnvelope } from './saturationAnalysis';
import { calculateTerminalResolution } from './terminalResolution';
import { buildDivergenceTopology } from './divergenceTopology';
import { certifyConvergence } from './convergenceCertification';
import type {
  ConvergenceRisk,
  ConvergenceTopology,
  RuntimeConvergenceEnvelope,
} from './convergenceTypes';

export * from './convergenceTypes';
export * from './convergenceSpace';
export * from './fixedPointLattice';
export * from './resolutionConvergence';
export * from './stabilityEnvelope';
export * from './monotonicResolution';
export * from './saturationAnalysis';
export * from './terminalResolution';
export * from './divergenceTopology';
export * from './convergenceCertification';
export * from './aggregation';
export * from './convergenceAdapters';
export * from './convergenceObservability';
export * from './convergenceExplainers';
export * from './convergenceGuards';
export * from './assertConvergenceIntegrity';

function buildTopology(
  space: ReturnType<typeof buildConvergenceSpace>,
  fps: ReturnType<typeof resolveAllFixedPoints>,
): ConvergenceTopology {
  const ids = new Set(space.nodes.map((n) => n.id));
  let edges = 0;
  for (const n of space.nodes) {
    for (const s of n.successors) if (ids.has(s)) edges += 1;
  }
  const cycles = fps.filter((f) => f.classification === 'OSCILLATING').length;
  const recursive = cycles > 0;
  // fragmentation: any node unreachable from node[0]
  let fragmented = false;
  if (space.nodes.length > 0) {
    const reachable = new Set<string>();
    const stack = [space.nodes[0].id];
    while (stack.length) {
      const cur = stack.pop()!;
      if (reachable.has(cur)) continue;
      reachable.add(cur);
      const n = space.nodes.find((x) => x.id === cur);
      if (!n) continue;
      for (const s of n.successors) if (ids.has(s)) stack.push(s);
    }
    fragmented = reachable.size < ids.size;
  }
  const fragments = fragmented ? 2 : 1;
  return Object.freeze({
    nodes: space.nodes.length,
    edges,
    cycles,
    fragments,
    fragmented,
    recursive,
  });
}

function buildRisks(env: Omit<RuntimeConvergenceEnvelope, 'risks' | 'score' | 'stable'>): {
  readonly risks: readonly ConvergenceRisk[];
  readonly score: number;
  readonly stable: boolean;
} {
  const risks: ConvergenceRisk[] = [];
  if (env.classification === 'DIVERGENT')
    risks.push(Object.freeze({
      code: 'CONVERGENCE_DIVERGENCE',
      severity: 'critical',
      description: 'convergence divergent',
    }));
  if (env.classification === 'COLLAPSING')
    risks.push(Object.freeze({
      code: 'CONVERGENCE_COLLAPSE',
      severity: 'critical',
      description: 'convergence collapsing',
    }));
  if (env.saturation.level === 'CRITICAL')
    risks.push(Object.freeze({
      code: 'CONVERGENCE_SATURATION_CRITICAL',
      severity: 'critical',
      description: 'saturation critical',
    }));
  if (env.terminal.infinite)
    risks.push(Object.freeze({
      code: 'CONVERGENCE_INFINITE_RESOLUTION',
      severity: 'critical',
      description: 'infinite resolution',
    }));
  if (env.terminal.failed)
    risks.push(Object.freeze({
      code: 'CONVERGENCE_TERMINAL_RESOLUTION_FAILED',
      severity: 'error',
      description: 'terminal resolution failed',
    }));
  if (env.monotonic.classification === 'BROKEN' || env.monotonic.classification === 'REVERSING')
    risks.push(Object.freeze({
      code: 'CONVERGENCE_MONOTONICITY_BROKEN',
      severity: 'error',
      description: `monotonicity ${env.monotonic.classification.toLowerCase()}`,
    }));
  if (env.stability.overflow || env.stability.recursiveInstability)
    risks.push(Object.freeze({
      code: 'CONVERGENCE_FIXED_POINT_UNSTABLE',
      severity: 'critical',
      description: 'stability envelope compromised',
    }));
  if (env.topology.fragmented || env.divergence.fragmented)
    risks.push(Object.freeze({
      code: 'CONVERGENCE_TOPOLOGY_FRAGMENTED',
      severity: 'error',
      description: 'topology fragmented',
    }));
  if (env.certification.rank === 'BLOCKED')
    risks.push(Object.freeze({
      code: 'CONVERGENCE_CERTIFICATION_INVALID',
      severity: 'critical',
      description: 'certification blocked',
    }));

  const score = env.certification.confidence;
  const stable =
    risks.every((r) => r.severity !== 'critical') && score >= 0.5;
  return { risks: Object.freeze(risks), score, stable };
}

export function buildConvergenceEnvelope(
  id: string,
  raws: readonly RawConvergenceNodeInput[],
): RuntimeConvergenceEnvelope {
  const space = buildConvergenceSpace(raws);
  const fixedPoints = resolveAllFixedPoints(space);
  const classification = classifyResolutionStability(fixedPoints);
  const topology = buildTopology(space, fixedPoints);
  const saturation = buildSaturationEnvelope(fixedPoints);
  const terminal = calculateTerminalResolution(fixedPoints);
  const monotonic = buildMonotonicResolution(space, fixedPoints);
  const stability = buildStabilityEnvelope(fixedPoints);
  const divergence = buildDivergenceTopology(space, fixedPoints);
  const readOnlyOk = space.nodes.every(
    (n) =>
      !n.liveExecutionEnabled &&
      !n.retryEnabled &&
      !n.backgroundEnabled &&
      !n.realUsersAllowed &&
      n.stage === 'STAGE_0_READ_ONLY',
  );
  const certification = certifyConvergence({
    classification,
    fixedPoints,
    saturation,
    terminal,
    monotonic,
    stability,
    divergence,
    readOnlyOk,
  });
  const partial = {
    id,
    space,
    fixedPoints,
    classification,
    topology,
    saturation,
    terminal,
    monotonic,
    stability,
    divergence,
    certification,
  };
  const { risks, score, stable } = buildRisks(partial);
  return Object.freeze({ ...partial, risks, score, stable });
}

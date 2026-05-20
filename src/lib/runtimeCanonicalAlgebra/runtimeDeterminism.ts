import type {
  RuntimeDeterminism,
  RuntimeDeterminismLevel,
  RuntimeNode,
  RuntimeTransition,
} from './algebraTypes';

export function classifyDeterminism(args: {
  varianceCount: number;
  nonDeterministicCount: number;
  total: number;
  temporalInstability: boolean;
}): RuntimeDeterminismLevel {
  const { varianceCount, nonDeterministicCount, total, temporalInstability } = args;
  if (total === 0) return 'strict';
  const ratio = nonDeterministicCount / total;
  if (temporalInstability && ratio > 0.5) return 'divergent';
  if (ratio > 0.5) return 'unstable';
  if (ratio > 0.2 || temporalInstability) return 'eventual';
  if (varianceCount > 0) return 'stable';
  return 'strict';
}

export function detectNonDeterminism(
  transitions: readonly RuntimeTransition[],
): readonly RuntimeTransition[] {
  return transitions.filter((t) => !t.deterministic && t.possible);
}

export function detectTemporalInstability(
  transitions: readonly RuntimeTransition[],
): boolean {
  return transitions.some((t) => t.regression);
}

export function detectReplayVariance(
  transitions: readonly RuntimeTransition[],
): number {
  return transitions.filter((t) => t.mode === 'degraded' || t.mode === 'unstable').length;
}

export function detectStateVariance(nodes: readonly RuntimeNode[]): number {
  let v = 0;
  for (const n of nodes) {
    if (n.state.classification === 'unstable' || n.state.classification === 'divergent') v++;
  }
  return v;
}

export function aggregateDeterminismHealth(
  nodes: readonly RuntimeNode[],
  transitions: readonly RuntimeTransition[],
): RuntimeDeterminism {
  const nonDet = detectNonDeterminism(transitions);
  const variance = detectReplayVariance(transitions) + detectStateVariance(nodes);
  const temporal = detectTemporalInstability(transitions);
  const level = classifyDeterminism({
    varianceCount: variance,
    nonDeterministicCount: nonDet.length,
    total: transitions.length,
    temporalInstability: temporal,
  });
  return Object.freeze<RuntimeDeterminism>({
    level,
    varianceCount: variance,
    nonDeterministicNodes: Object.freeze(
      nodes
        .filter((n) => n.state.classification === 'unstable' || n.state.classification === 'divergent')
        .map((n) => n.id),
    ),
    temporalInstability: temporal,
  });
}

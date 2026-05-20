/**
 * Fase 1.9.2 — Pure explainers (READ-ONLY).
 */

import type {
  ConvergenceClass,
  DivergenceTopology,
  MonotonicResolution,
  ResolutionFixedPoint,
  SaturationEnvelope,
  TerminalResolutionState,
} from './convergenceTypes';

export function explainConvergence(c: ConvergenceClass): string {
  switch (c) {
    case 'STABLE':
      return 'system has reached stable equilibrium';
    case 'EVENTUAL':
      return 'system converges eventually within bounded iterations';
    case 'OSCILLATING':
      return 'system oscillates between recurring states';
    case 'DIVERGENT':
      return 'system diverges away from equilibrium';
    case 'COLLAPSING':
      return 'system is collapsing into degenerate states';
  }
}

export function explainFixedPoint(fp: ResolutionFixedPoint): string {
  return `fixed point ${fp.id} reached in ${fp.iterations} steps (${fp.classification.toLowerCase()})`;
}

export function explainSaturation(s: SaturationEnvelope): string {
  return `saturation level ${s.level} at score ${s.score.toFixed(2)}`;
}

export function explainTerminality(t: TerminalResolutionState): string {
  return `terminality=${t.terminality} infinite=${t.infinite} partial=${t.partial} failed=${t.failed}`;
}

export function explainDivergence(d: DivergenceTopology): string {
  return `divergence severity=${d.severity} radius=${d.radius} recursive=${d.recursive} crossLayer=${d.crossLayer} fragmented=${d.fragmented}`;
}

export function explainMonotonicity(m: MonotonicResolution): string {
  return `monotonicity=${m.classification} score=${m.score.toFixed(2)} regressed=${m.regressed} reversed=${m.reversed}`;
}

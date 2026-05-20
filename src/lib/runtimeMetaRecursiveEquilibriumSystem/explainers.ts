/**
 * Fase 1.9.12 — Deterministic explainers (READ-ONLY).
 */

import { deepFreeze } from './recursiveEquilibrium';
import type {
  ReqCertification,
  ReqConvergenceModel,
  ReqContainment,
  ReqEnvelope,
} from './recursiveEquilibriumTypes';

export interface ReqExplanation {
  readonly target: string;
  readonly lines: readonly string[];
}

const fixed = (n: number): string => n.toFixed(6);

export function explainReqConvergence(target: string, m: ReqConvergenceModel): ReqExplanation {
  return deepFreeze({
    target,
    lines: Object.freeze(
      [
        `class=${m.classification}`,
        `confidence=${fixed(m.confidence)}`,
        `regressed=${m.regressed ? '1' : '0'}`,
        `recovered=${m.recovered ? '1' : '0'}`,
      ].sort(),
    ),
  });
}

export function explainReqCertification(target: string, c: ReqCertification): ReqExplanation {
  return deepFreeze({
    target,
    lines: Object.freeze(
      [
        `rank=${c.rank}`,
        `confidence=${fixed(c.confidence)}`,
        ...c.reasons.map((r) => `reason:${r}`),
      ].sort(),
    ),
  });
}

export function explainReqContainment(target: string, c: ReqContainment): ReqExplanation {
  return deepFreeze({
    target,
    lines: Object.freeze(
      [
        `class=${c.classification}`,
        `depth=${c.depth}`,
        `leaking=${c.leaking ? '1' : '0'}`,
        `collapsing=${c.collapsing ? '1' : '0'}`,
      ].sort(),
    ),
  });
}

export function explainReqEnvelope(env: ReqEnvelope): ReqExplanation {
  return deepFreeze({
    target: env.id,
    lines: Object.freeze(
      [
        `id=${env.id}`,
        `convergence=${env.convergence.classification}`,
        `containment=${env.containment.classification}`,
        `cert=${env.certification.rank}`,
        `topology=${env.topology.mode}`,
        `propagation=${env.propagation.mode}`,
        `stable=${env.stability.bounded ? '1' : '0'}`,
        `signature=${env.signature}`,
      ].sort(),
    ),
  });
}

/**
 * Fase 1.9.11 — Deterministic explainers (READ-ONLY).
 */

import { deepFreeze } from './fixedPointCategory';
import type {
  FpcCertification,
  FpcConvergenceModel,
  FpcContainment,
  FpcEnvelope,
} from './fixedPointCategoryTypes';

export interface FpcExplanation {
  readonly target: string;
  readonly lines: readonly string[];
}

function fixed(n: number): string {
  return n.toFixed(6);
}

export function explainConvergence(target: string, m: FpcConvergenceModel): FpcExplanation {
  const lines = [
    `class=${m.classification}`,
    `confidence=${fixed(m.confidence)}`,
    `regressed=${m.regressed ? '1' : '0'}`,
  ].sort();
  return deepFreeze({ target, lines: Object.freeze(lines) });
}

export function explainCertification(target: string, c: FpcCertification): FpcExplanation {
  const lines = [
    `rank=${c.rank}`,
    `confidence=${fixed(c.confidence)}`,
    ...c.reasons.map((r) => `reason:${r}`),
  ].sort();
  return deepFreeze({ target, lines: Object.freeze(lines) });
}

export function explainContainment(target: string, c: FpcContainment): FpcExplanation {
  const lines = [
    `class=${c.classification}`,
    `depth=${c.depth}`,
    `leaking=${c.leaking ? '1' : '0'}`,
    `collapsing=${c.collapsing ? '1' : '0'}`,
  ].sort();
  return deepFreeze({ target, lines: Object.freeze(lines) });
}

export function explainEnvelope(env: FpcEnvelope): FpcExplanation {
  const lines = [
    `id=${env.id}`,
    `convergence=${env.convergence.classification}`,
    `containment=${env.containment.classification}`,
    `cert=${env.certification.rank}`,
    `topology=${env.topology.mode}`,
    `stable=${env.stability.bounded ? '1' : '0'}`,
    `signature=${env.signature}`,
  ].sort();
  return deepFreeze({ target: env.id, lines: Object.freeze(lines) });
}

/**
 * Fase 1.9.3 — Dissipation Analysis (READ-ONLY, pure).
 */
import type {
  DissipationClass,
  RuntimeDissipationEnvelope,
  RuntimeEntropyEnvelope,
  RuntimePropagationEnergy,
} from './equilibriumTypes';

export function calculateDissipation(
  entropy: RuntimeEntropyEnvelope,
  propagation: RuntimePropagationEnergy,
): RuntimeDissipationEnvelope {
  const score = (entropy.score + (1 - propagation.containment)) / 2;
  const recursive = detectRecursiveAmplification(entropy, propagation);
  const persistent = detectPersistentPropagation(entropy, propagation);
  const balance = calculateDissipationBalance(entropy, propagation);
  let classification: DissipationClass = 'DISSIPATED';
  if (recursive) classification = 'RECURSIVE';
  else if (propagation.amplified) classification = 'AMPLIFYING';
  else if (persistent) classification = 'PERSISTENT';
  else if (score > 0.3) classification = 'STABILIZING';
  return Object.freeze({ classification, score, recursive, persistent, balance });
}

export function detectRecursiveAmplification(
  entropy: RuntimeEntropyEnvelope,
  propagation: RuntimePropagationEnergy,
): boolean {
  return entropy.escalating && propagation.amplified;
}

export function detectPersistentPropagation(
  entropy: RuntimeEntropyEnvelope,
  propagation: RuntimePropagationEnergy,
): boolean {
  return entropy.score > 0.4 && propagation.amplitude > 0.4 && !propagation.unbounded;
}

export function calculateDissipationBalance(
  entropy: RuntimeEntropyEnvelope,
  propagation: RuntimePropagationEnergy,
): number {
  return Math.max(0, Math.min(1, (1 - entropy.score + propagation.containment) / 2));
}

/**
 * Fase 1.9.3 — Metastable States (READ-ONLY, pure).
 */
import type { EquilibriumClass, MetastableState, RuntimeEntropyEnvelope, RuntimeStabilityField } from './equilibriumTypes';

export function detectMetastableState(
  field: RuntimeStabilityField,
  entropy: RuntimeEntropyEnvelope,
  classification: EquilibriumClass,
): MetastableState {
  const score = calculateMetastability(field, entropy);
  const metastable = classification === 'META_STABLE' || (score > 0.4 && score < 0.7);
  const temporary = detectTemporaryEquilibrium(field, entropy);
  const unstable = detectUnstableStabilization(field, entropy);
  return Object.freeze({ metastable, score, temporary, unstable });
}

export function calculateMetastability(field: RuntimeStabilityField, entropy: RuntimeEntropyEnvelope): number {
  return Math.max(0, Math.min(1, field.localStability * (1 - entropy.score)));
}

export function detectTemporaryEquilibrium(field: RuntimeStabilityField, entropy: RuntimeEntropyEnvelope): boolean {
  return field.leakage > 0.2 && entropy.score > 0.3;
}

export function detectUnstableStabilization(field: RuntimeStabilityField, entropy: RuntimeEntropyEnvelope): boolean {
  return field.pressure > 0.5 && field.globalStability > 0.5 && entropy.escalating;
}

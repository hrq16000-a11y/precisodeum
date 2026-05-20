/**
 * Fase 1.9.3 — Canonical Equilibrium (READ-ONLY, pure).
 */
import type {
  CanonicalEquilibriumState,
  EquilibriumClass,
  RuntimeStabilityField,
} from './equilibriumTypes';

export function buildCanonicalEquilibrium(
  field: RuntimeStabilityField,
  classification: EquilibriumClass,
): CanonicalEquilibriumState {
  const signature = `${classification}|${field.signature}`;
  const drift = detectEquilibriumDrift(field, classification);
  const distance = calculateCanonicalDistance(field, classification);
  const normalized = normalizeEquilibriumState(signature) === signature;
  return Object.freeze({ signature, drift, distance, normalized });
}

export function normalizeEquilibriumState(sig: string): string {
  return sig.split('|').sort().join('|');
}

export function detectEquilibriumDrift(field: RuntimeStabilityField, classification: EquilibriumClass): number {
  const base = classification === 'STABLE' ? 0 : classification === 'META_STABLE' ? 0.25 : classification === 'TRANSIENT' ? 0.5 : classification === 'FRACTURED' ? 0.75 : 1;
  return Math.max(0, Math.min(1, base + field.leakage * 0.25));
}

export function calculateCanonicalDistance(field: RuntimeStabilityField, classification: EquilibriumClass): number {
  const stability = field.globalStability;
  const ideal = classification === 'STABLE' ? 1 : 0.5;
  return Math.abs(ideal - stability);
}

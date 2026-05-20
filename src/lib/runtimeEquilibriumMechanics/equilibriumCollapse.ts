/**
 * Fase 1.9.3 — Equilibrium Collapse (READ-ONLY, pure).
 */
import type {
  EquilibriumClass,
  EquilibriumCollapseState,
  RuntimeStabilityField,
  RuntimeTopologyTension,
} from './equilibriumTypes';

export function detectEquilibriumCollapse(
  field: RuntimeStabilityField,
  topology: RuntimeTopologyTension,
  classification: EquilibriumClass,
): EquilibriumCollapseState {
  const collapsed = field.collapsed || topology.collapsing || classification === 'COLLAPSED';
  const irrecoverable = detectIrrecoverableEquilibrium(field, topology);
  const cascade = detectCascadeCollapse(field, topology);
  const radius = calculateCollapseRadius(field, topology);
  return Object.freeze({ collapsed, irrecoverable, cascade, radius });
}

export function detectIrrecoverableEquilibrium(
  field: RuntimeStabilityField,
  topology: RuntimeTopologyTension,
): boolean {
  return field.collapsed && topology.collapsing && field.globalStability < 0.1;
}

export function detectCascadeCollapse(
  field: RuntimeStabilityField,
  topology: RuntimeTopologyTension,
): boolean {
  return topology.fractured && field.leakage > 0.4;
}

export function calculateCollapseRadius(
  field: RuntimeStabilityField,
  topology: RuntimeTopologyTension,
): number {
  if (field.nodes.length === 0) return 0;
  const radius = (field.leakage + (topology.collapsing ? 0.5 : 0) + (1 - field.globalStability)) / 3;
  return Math.max(0, Math.min(1, radius));
}

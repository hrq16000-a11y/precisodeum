/**
 * Fase 1.8.8 — Immutable explainers (READ-ONLY, pure strings).
 */

import type {
  ImmutableCertification,
  ImmutableSeal,
  ImmutableViolation,
} from './immutableTypes';
import type { ImmutableTopologyAnalysis } from './immutableTopology';
import type { ImmutableContainmentAnalysis } from './immutableContainment';

export function explainImmutableSeal(s: ImmutableSeal): string {
  return `seal[${s.flow}]=${s.classification}/${s.severity}/compromised=${s.compromised}/violations=${s.violations.length}`;
}

export function explainImmutableViolation(v: ImmutableViolation): string {
  return `violation[${v.flow}]=${v.type}/${v.severity}/layer=${v.layer}/${v.detail}`;
}

export function explainImmutableTopology(t: ImmutableTopologyAnalysis): string {
  return `topology[${t.flow}]=layers=${t.layers}/overlaps=${t.overlaps}/recursive=${t.recursive}/risk=${t.riskScore}`;
}

export function explainImmutableContainment(c: ImmutableContainmentAnalysis): string {
  return `containment[${c.flow}]=${c.integrity}/violations=${c.violations.length}`;
}

export function explainImmutableCertification(c: ImmutableCertification): string {
  return `cert[${c.flow}]=${c.level}/confidence=${c.confidence}/certified=${c.certified}/reasons=${c.reasons.length}`;
}

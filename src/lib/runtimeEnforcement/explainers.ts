/**
 * Fase 1.8.7 — Enforcement explainers (READ-ONLY, pure strings).
 */

import type {
  EnforcementCertification,
  EnforcementViolation,
  LockdownClassification,
  RuntimeEnforcement,
} from './enforcementTypes';
import type { TopologyAnalysis } from './topologyEnforcement';

export function explainEnforcement(e: RuntimeEnforcement): string {
  return `enforcement[${e.flow}]=${e.classification}/${e.severity}/lockdown=${e.lockdown}/violations=${e.violations.length}`;
}

export function explainLockdown(l: LockdownClassification): string {
  return `lockdown=${l}`;
}

export function explainEnforcementViolation(v: EnforcementViolation): string {
  return `violation[${v.flow}]=${v.type}/${v.severity}/layer=${v.layer}/${v.detail}`;
}

export function explainEnforcementTopology(t: TopologyAnalysis): string {
  return `topology[${t.flow}]=layers=${t.layers}/overlaps=${t.overlaps}/recursive=${t.recursive}/risk=${t.riskScore}`;
}

export function explainEnforcementCertification(c: EnforcementCertification): string {
  return `cert[${c.flow}]=${c.level}/confidence=${c.confidence}/certified=${c.certified}/reasons=${c.reasons.length}`;
}

/**
 * Fase 1.8.6 — Isolation explainers (READ-ONLY, pure, deterministic strings).
 */

import type {
  IsolationAggregation,
  IsolationCertification,
  IsolationEnvelope,
  IsolationLeak,
  IsolationTopology,
} from './isolationTypes';

export function explainIsolation(e: IsolationEnvelope): string {
  return `Flow ${e.flow}: ${e.classification} (score=${e.score}, severity=${e.severity}).`;
}

export function explainIsolationLeak(l: IsolationLeak): string {
  return `Leak ${l.type} severity=${l.severity} em ${l.flow}: ${l.detail}`;
}

export function explainIsolationCertification(c: IsolationCertification): string {
  const status = c.certified ? 'CERTIFIED' : 'NOT_CERTIFIED';
  const reasons = c.reasons.length ? ` Razões: ${c.reasons.join(', ')}.` : '';
  return `Cert ${c.flow}: ${status} (conf=${c.confidence}, ${c.classification}/${c.severity}).${reasons}`;
}

export function explainIsolationTopology(t: IsolationTopology): string {
  return `Topology ${t.flow}: overlaps=${t.overlaps} recursive=${t.recursive} unsafeCoupling=${t.unsafeCoupling}.`;
}

export function explainIsolationAggregation(a: IsolationAggregation): string {
  return `Agg flows=${a.flows} fully=${a.fullyIsolated} contained=${a.contained} shared=${a.boundaryShared} leaking=${a.leaking} collapsed=${a.collapsed} avg=${a.averageScore} worst=${a.worstSeverity}.`;
}

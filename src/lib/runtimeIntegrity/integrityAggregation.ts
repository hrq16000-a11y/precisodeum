/**
 * Fase 1.8.5 — Integrity aggregation (READ-ONLY, pure).
 */

import type {
  IntegrityRisk,
  RuntimeIntegrityContainment,
  RuntimeIntegrityEnvelope,
  RuntimeIntegrityHealth,
  RuntimeIntegrityIsolation,
  RuntimeIntegritySummary,
} from './integrityTypes';

const RISK_RANK: Record<IntegrityRisk, number> = {
  none: 0, low: 1, medium: 2, high: 3, critical: 4,
};
function fromRank(r: number): IntegrityRisk {
  const map: IntegrityRisk[] = ['none', 'low', 'medium', 'high', 'critical'];
  return map[Math.max(0, Math.min(4, r))];
}

export function aggregateIntegrityHealth(
  envelopes: readonly RuntimeIntegrityEnvelope[],
): RuntimeIntegrityHealth {
  if (envelopes.length === 0) {
    return { flows: 0, intact: 0, degraded: 0, unstable: 0, compromised: 0, collapsed: 0, averageScore: 0, worstRisk: 'none' };
  }
  let intact = 0, degraded = 0, unstable = 0, compromised = 0, collapsed = 0;
  let sum = 0;
  let worst = 0;
  for (const e of envelopes) {
    if (e.classification === 'intact') intact++;
    else if (e.classification === 'degraded') degraded++;
    else if (e.classification === 'unstable') unstable++;
    else if (e.classification === 'compromised') compromised++;
    else if (e.classification === 'collapsed') collapsed++;
    sum += e.score;
    worst = Math.max(worst, RISK_RANK[e.risk]);
  }
  return {
    flows: envelopes.length,
    intact, degraded, unstable, compromised, collapsed,
    averageScore: Math.round((sum / envelopes.length) * 100) / 100,
    worstRisk: fromRank(worst),
  };
}

export function summarizeIntegrityRisk(
  envelopes: readonly RuntimeIntegrityEnvelope[],
): RuntimeIntegritySummary[] {
  return envelopes.map((e) => ({
    flow: e.flow,
    classification: e.classification,
    risk: e.risk,
    containment: e.containment[0]?.containment ?? 'contained',
    isolation: e.isolation.isolation,
  }));
}

export function rankIntegrityInstability(
  envelopes: readonly RuntimeIntegrityEnvelope[],
): RuntimeIntegrityEnvelope[] {
  return [...envelopes].sort((a, b) => a.score - b.score);
}

export function summarizeContainmentHealth(
  containments: readonly RuntimeIntegrityContainment[],
): { contained: number; partial: number; leaking: number; cascading: number; unbounded: number } {
  const out = { contained: 0, partial: 0, leaking: 0, cascading: 0, unbounded: 0 };
  for (const c of containments) {
    if (c.containment === 'contained') out.contained++;
    else if (c.containment === 'partially_contained') out.partial++;
    else if (c.containment === 'leaking') out.leaking++;
    else if (c.containment === 'cascading') out.cascading++;
    else if (c.containment === 'unbounded') out.unbounded++;
  }
  return out;
}

export function summarizeIsolationHealth(
  isolations: readonly RuntimeIntegrityIsolation[],
): { isolated: number; shared: number; mirror: number; replay: number; global: number } {
  const out = { isolated: 0, shared: 0, mirror: 0, replay: 0, global: 0 };
  for (const i of isolations) {
    if (i.isolation === 'isolated') out.isolated++;
    else if (i.isolation === 'boundary_shared') out.shared++;
    else if (i.isolation === 'mirror_exposed') out.mirror++;
    else if (i.isolation === 'replay_exposed') out.replay++;
    else if (i.isolation === 'globally_exposed') out.global++;
  }
  return out;
}

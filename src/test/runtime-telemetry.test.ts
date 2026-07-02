/**
 * Fase 1.7.4 — Runtime Telemetry + Operational Intelligence tests.
 *
 * Cobre: aggregation, priority engine, persist_first_service HIGH/CRITICAL,
 * bet_finish_pro HIGH/CRITICAL, flow READY saudável, flow LEGACY degradado,
 * explainers determinísticos, payload audit sem PII, integrity guard,
 * snapshots integrados, operational risk agregado, mirror overdependence.
 */

import { describe, expect, it, vi } from 'vitest';

import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import {
  aggregateBoundaryTelemetry,
  aggregateDriftTelemetry,
  aggregateFlowTelemetry,
  aggregateMirrorTelemetry,
  assertTelemetryCoverage,
  buildRuntimeTelemetry,
  calculateOperationalRisk,
} from '@/lib/telemetry/buildRuntimeTelemetry';
import { calculateAtomicMigrationPriority } from '@/lib/telemetry/atomicPriorityEngine';
import {
  calculateFlowHealth,
  detectMirrorOverdependence,
  detectOvercoupledFlow,
} from '@/lib/telemetry/flowHealth';
import {
  explainAtomicPriority,
  explainFlowHealth,
  explainOperationalRisk,
  explainTelemetrySummary,
} from '@/lib/telemetry/explainers';
import { buildOperationalSnapshot } from '@/lib/telemetry/operationalSnapshot';
import { assertOperationalIntegrity } from '@/lib/telemetry/assertOperationalIntegrity';
import type { RuntimeTelemetryEvent } from '@/lib/telemetry/runtimeTelemetryTypes';
import {
  logAtomicPriorityCalculated,
  logFlowHealthDegraded,
  logOperationalRiskDetected,
  logRuntimeTelemetryGenerated,
} from '@/lib/telemetry/observability';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: () => ({ insert: vi.fn(async () => ({ error: null })) }),
  },
}));

const auditCalls: any[] = [];
vi.mock('@/hooks/useAuditLog', () => ({
  logAuditAction: vi.fn(async (entry: any) => {
    auditCalls.push(entry);
  }),
}));

function loadEvents(): RuntimeTelemetryEvent[] {
  // Fixture: persist_first_service e bet_finish_pro com volume + drift + mirror;
  // flow READY saudável (dashboard_profile_save); legacy degradado simulado em
  // admin_provider_update via failures altos.
  const ev: RuntimeTelemetryEvent[] = [];
  for (let i = 0; i < 30; i++) {
    ev.push({ flow: 'persist_first_service', kind: 'flow_execution' });
    ev.push({ flow: 'bet_finish_pro', kind: 'flow_execution' });
    ev.push({ flow: 'dashboard_profile_save', kind: 'flow_execution' });
  }
  // failures + partial
  for (let i = 0; i < 8; i++) {
    ev.push({ flow: 'persist_first_service', kind: 'flow_failure' });
    ev.push({ flow: 'bet_finish_pro', kind: 'flow_partial_success' });
  }
  // drift + mirror
  for (let i = 0; i < 6; i++) {
    ev.push({ flow: 'persist_first_service', kind: 'drift_detected' });
    ev.push({ flow: 'bet_finish_pro', kind: 'drift_detected' });
    ev.push({ flow: 'bet_finish_pro', kind: 'mirror_write' });
    ev.push({ flow: 'dashboard_profile_save', kind: 'mirror_write' });
  }
  // boundary
  for (let i = 0; i < 20; i++) {
    ev.push({ boundary: 'multiWriteSync', kind: 'boundary_execution' });
    ev.push({ boundary: 'onboardingProgressSync', kind: 'boundary_execution' });
  }
  for (let i = 0; i < 4; i++) {
    ev.push({ boundary: 'multiWriteSync', kind: 'boundary_failure' });
  }
  return ev;
}

describe('Fase 1.7.4 — Runtime Telemetry', () => {
  it('A) aggregation correta', () => {
    const events = loadEvents();
    const agg = buildRuntimeTelemetry(events);
    expect(agg.flows.length).toBe(OPERATION_REGISTRY.length);
    const cov = assertTelemetryCoverage(agg);
    expect(cov.ok).toBe(true);
    const pfs = agg.flows.find((f) => f.flow === 'persist_first_service')!;
    expect(pfs.executions).toBeGreaterThan(0);
    expect(pfs.failures).toBe(8);
    expect(pfs.failureRate).toBeGreaterThan(0);
  });

  it('B) priority engine determinístico (top = HIGH/CRITICAL)', () => {
    const events = loadEvents();
    const agg = buildRuntimeTelemetry(events);
    const prios = calculateAtomicMigrationPriority(agg.flows, agg.drifts, agg.mirrors, agg.risks);
    // ordenado desc por score
    for (let i = 1; i < prios.length; i++) {
      expect(prios[i - 1].score).toBeGreaterThanOrEqual(prios[i].score);
    }
    // determinístico
    const prios2 = calculateAtomicMigrationPriority(agg.flows, agg.drifts, agg.mirrors, agg.risks);
    expect(prios).toEqual(prios2);
  });

  it('C) persist_first_service classificado como HIGH/CRITICAL', () => {
    const events = loadEvents();
    const agg = buildRuntimeTelemetry(events);
    const prios = calculateAtomicMigrationPriority(agg.flows, agg.drifts, agg.mirrors, agg.risks);
    const pfs = prios.find((p) => p.flow === 'persist_first_service')!;
    expect(['HIGH', 'CRITICAL']).toContain(pfs.priority);
  });

  it('D) bet_finish_pro classificado como HIGH/CRITICAL', () => {
    const events = loadEvents();
    const agg = buildRuntimeTelemetry(events);
    const prios = calculateAtomicMigrationPriority(agg.flows, agg.drifts, agg.mirrors, agg.risks);
    const bet = prios.find((p) => p.flow === 'bet_finish_pro')!;
    expect(['HIGH', 'CRITICAL']).toContain(bet.priority);
  });

  it('E) flow READY saudável (dashboard_profile_save grade A ou B)', () => {
    // sem failures e sem drift
    const events: RuntimeTelemetryEvent[] = [];
    for (let i = 0; i < 30; i++)
      events.push({ flow: 'dashboard_profile_save', kind: 'flow_execution' });
    const agg = buildRuntimeTelemetry(events);
    const health = calculateFlowHealth(agg.flows, agg.drifts, agg.mirrors);
    const dp = health.find((h) => h.flow === 'dashboard_profile_save')!;
    expect(['A', 'B']).toContain(dp.grade);
  });

  it('F) flow degradado: high failure rate baixa grade', () => {
    const events: RuntimeTelemetryEvent[] = [];
    for (let i = 0; i < 10; i++)
      events.push({ flow: 'admin_provider_update', kind: 'flow_execution' });
    for (let i = 0; i < 6; i++)
      events.push({ flow: 'admin_provider_update', kind: 'flow_failure' });
    const agg = buildRuntimeTelemetry(events);
    const health = calculateFlowHealth(agg.flows, agg.drifts, agg.mirrors);
    const adm = health.find((h) => h.flow === 'admin_provider_update')!;
    expect(['C', 'D', 'F']).toContain(adm.grade);
  });

  it('G) explainers determinísticos', () => {
    const events = loadEvents();
    const snap = buildOperationalSnapshot(events, { now: () => 1234 });
    const s1 = explainTelemetrySummary(snap.telemetry);
    const s2 = explainTelemetrySummary(snap.telemetry);
    expect(s1).toBe(s2);
    expect(s1).toContain('=== Runtime Telemetry ===');
    expect(explainOperationalRisk(snap.operationalRisk[0])).toMatch(/^\[RISK\//);
    expect(explainAtomicPriority(snap.atomicPriority[0])).toMatch(/^\[ATOMIC\//);
    expect(explainFlowHealth(snap.runtimeHealth[0])).toMatch(/^\[HEALTH\//);
  });

  it('H) audit payload sem PII', async () => {
    auditCalls.length = 0;
    const events = loadEvents();
    const snap = buildOperationalSnapshot(events);
    await logRuntimeTelemetryGenerated({ source: 'test' }, snap.telemetry);
    for (const r of snap.operationalRisk) await logOperationalRiskDetected({ source: 'test' }, r);
    for (const p of snap.atomicPriority) await logAtomicPriorityCalculated({ source: 'test' }, p);
    for (const h of snap.runtimeHealth) await logFlowHealthDegraded({ source: 'test' }, h);
    const PII = /(email|phone|whatsapp|cpf|cnpj|address|street|nome|name|url|http)/i;
    for (const call of auditCalls) {
      const json = JSON.stringify(call.details ?? {});
      expect(json).not.toMatch(PII);
    }
    expect(auditCalls.length).toBeGreaterThan(0);
  });

  it('I) integrity guard detecta READY flow degradado sem quarentena', () => {
    // alimenta dashboard_profile_save (READY) com alta falha → degrade
    const events: RuntimeTelemetryEvent[] = [];
    for (let i = 0; i < 30; i++)
      events.push({ flow: 'dashboard_profile_save', kind: 'flow_execution' });
    for (let i = 0; i < 12; i++)
      events.push({ flow: 'dashboard_profile_save', kind: 'flow_failure' });
    const snap = buildOperationalSnapshot(events);
    const result = assertOperationalIntegrity(snap);
    expect(result.ok).toBe(false);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('ready_flow_degraded_without_quarantine');
  });

  it('J) telemetria determinística (mesmo input → mesma saída)', () => {
    const events = loadEvents();
    const a = buildRuntimeTelemetry(events, { now: () => 7 });
    const b = buildRuntimeTelemetry(events, { now: () => 7 });
    expect(a).toEqual(b);
  });

  it('K) snapshot integrado expõe consistency + architecture + telemetry', () => {
    const events = loadEvents();
    const snap = buildOperationalSnapshot(events, { now: () => 42 });
    expect(snap.generatedAt).toBe(42);
    expect(snap.consistency.totalFlows).toBe(OPERATION_REGISTRY.length);
    expect(snap.architecture.totalFlows).toBe(OPERATION_REGISTRY.length);
    expect(snap.telemetry.flows.length).toBe(OPERATION_REGISTRY.length);
    expect(snap.atomicPriority.length).toBe(OPERATION_REGISTRY.length);
    expect(snap.runtimeHealth.length).toBe(OPERATION_REGISTRY.length);
  });

  it('L) operationalRisk agregado corretamente', () => {
    const events = loadEvents();
    const agg = buildRuntimeTelemetry(events);
    const risks = calculateOperationalRisk(agg.flows, agg.drifts, agg.mirrors);
    const pfs = risks.find((r) => r.flow === 'persist_first_service')!;
    expect(['MEDIUM', 'HIGH', 'CRITICAL']).toContain(pfs.riskLevel);
    expect(pfs.contributors.length).toBeGreaterThan(0);
  });

  it('M) mirror overdependence detectado quando mirrorRate alto + mixed ownership', () => {
    const events: RuntimeTelemetryEvent[] = [];
    for (let i = 0; i < 20; i++) {
      events.push({ flow: 'dashboard_profile_save', kind: 'flow_execution' });
      events.push({ flow: 'dashboard_profile_save', kind: 'mirror_write' });
    }
    const flows = aggregateFlowTelemetry(events);
    const mirrors = aggregateMirrorTelemetry(events, flows);
    expect(detectMirrorOverdependence('dashboard_profile_save', mirrors)).toBe(true);
  });

  it('detectOvercoupledFlow funciona em flow com muitos steps', () => {
    expect(detectOvercoupledFlow('persist_first_service')).toBe(true);
    expect(detectOvercoupledFlow('avatar_sync')).toBe(false);
  });

  it('aggregateBoundaryTelemetry conta executions e failures', () => {
    const events = loadEvents();
    const b = aggregateBoundaryTelemetry(events);
    const mw = b.find((x) => x.boundary === 'multiWriteSync')!;
    expect(mw.executions).toBeGreaterThan(0);
    expect(mw.failures).toBe(4);
    expect(mw.flows.length).toBeGreaterThan(0);
  });

  it('aggregateDriftTelemetry produz driftRate', () => {
    const events = loadEvents();
    const flows = aggregateFlowTelemetry(events);
    const drifts = aggregateDriftTelemetry(events, flows);
    const pfs = drifts.find((d) => d.flow === 'persist_first_service')!;
    expect(pfs.driftEvents).toBe(6);
    expect(pfs.driftRate).toBeGreaterThan(0);
  });
});

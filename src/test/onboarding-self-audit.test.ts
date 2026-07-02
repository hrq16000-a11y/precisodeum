/**
 * Self-Audit engine — testes unitários (puros, sem rede/DB).
 */
import { describe, it, expect } from 'vitest';
import {
  analyzeChangeRisk,
  auditConsistency,
  computeArchitecturalRisk,
  computeDebtScore,
  detectDashboardMismatch,
  detectDependencyCycles,
  detectGovernanceInconsistency,
  detectOperationalDebt,
  detectSqlTsParityBreak,
  detectTelemetryMismatch,
  SELF_AUDIT_POLICY,
  type AuditFinding,
} from '@/lib/onboarding/selfAudit';
import { GOVERNANCE_REGISTRY, type GovernanceItem } from '@/lib/onboarding/governanceRegistry';

const baseItem = (over: Partial<GovernanceItem>): GovernanceItem => ({
  id: 'x', kind: 'engine', title: 't', owner: 'o', version: '1.0.0',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  lifecycle: 'active', risk_level: 'low', dependencies: [], consumers: [],
  description: 'descrição suficiente para passar no docs drift mínimo.',
  ...over,
});

describe('SELF_AUDIT_POLICY', () => {
  it('é imutável e proíbe auto-mutações', () => {
    expect(SELF_AUDIT_POLICY.allow_auto_fix).toBe(false);
    expect(SELF_AUDIT_POLICY.allow_auto_delete).toBe(false);
    expect(SELF_AUDIT_POLICY.allow_auto_disable).toBe(false);
    expect(() => { (SELF_AUDIT_POLICY as any).allow_auto_fix = true; }).toThrow();
  });
});

describe('detectSqlTsParityBreak', () => {
  it('detecta valor divergente', () => {
    const f = detectSqlTsParityBreak({ a: 20 }, { a: 25 });
    expect(f.some((x) => x.code === 'threshold_drift')).toBe(true);
  });
  it('detecta lado órfão', () => {
    const f = detectSqlTsParityBreak({ a: 1 }, {});
    expect(f.some((x) => x.code === 'parity_break')).toBe(true);
  });
  it('sem drift → vazio', () => {
    expect(detectSqlTsParityBreak({ a: 1 }, { a: 1 })).toEqual([]);
  });
});

describe('detectTelemetryMismatch', () => {
  it('payload missing quando esperado não é visto', () => {
    const f = detectTelemetryMismatch([], ['phase_enter']);
    expect(f[0].code).toBe('telemetry_payload_missing');
  });
  it('taxonomy drift para evento não declarado', () => {
    const f = detectTelemetryMismatch(['rogue_event'], []);
    expect(f[0].code).toBe('telemetry_taxonomy_drift');
  });
  it('detecta colisão de naming case-insensitive', () => {
    const f = detectTelemetryMismatch(['Phase_Enter', 'phase_enter'], []);
    expect(f.some((x) => x.code === 'telemetry_mismatch')).toBe(true);
  });
});

describe('detectDashboardMismatch', () => {
  it('widget declarado mas não populado vira finding', () => {
    const f = detectDashboardMismatch(['card.a'], []);
    expect(f.some((x) => x.code === 'dashboard_without_data')).toBe(true);
  });
});

describe('detectDependencyCycles', () => {
  it('detecta ciclo A→B→A', () => {
    const items = [
      baseItem({ id: 'A', dependencies: ['B'] }),
      baseItem({ id: 'B', dependencies: ['A'] }),
    ];
    const f = detectDependencyCycles(items);
    expect(f.some((x) => x.code === 'dependency_cycle')).toBe(true);
  });
  it('detecta dependência morta', () => {
    const items = [baseItem({ id: 'A', dependencies: ['ghost'] })];
    const f = detectDependencyCycles(items);
    expect(f.some((x) => x.code === 'dead_dependency')).toBe(true);
  });
  it('registry real não tem ciclos', () => {
    const f = detectDependencyCycles(GOVERNANCE_REGISTRY);
    expect(f.filter((x) => x.code === 'dependency_cycle')).toEqual([]);
  });
});

describe('detectGovernanceInconsistency', () => {
  it('flag ativa não usada vira flag_without_runtime', () => {
    const items = [baseItem({ id: 'flag.x', kind: 'feature_flag' })];
    const f = detectGovernanceInconsistency({ usedItemIds: ['outro'] }, items);
    expect(f[0].code).toBe('flag_without_runtime');
  });
});

describe('detectOperationalDebt', () => {
  it('engine sem teste vira engine_without_test', () => {
    const items = [baseItem({ id: 'engine.a', kind: 'engine' })];
    const f = detectOperationalDebt({ engineTestCoverage: { 'engine.a': false } }, items);
    expect(f.some((x) => x.code === 'engine_without_test')).toBe(true);
  });
  it('heurísticas duplicadas detectadas por título', () => {
    const items = [
      baseItem({ id: 'h1', kind: 'heuristic', title: 'Same Title' }),
      baseItem({ id: 'h2', kind: 'heuristic', title: 'Same Title' }),
    ];
    const f = detectOperationalDebt({}, items);
    expect(f.some((x) => x.code === 'duplicated_heuristic')).toBe(true);
  });
});

describe('analyzeChangeRisk', () => {
  it('calcula blast radius via consumers transitivos', () => {
    const items = [
      baseItem({ id: 'A' }),
      baseItem({ id: 'B', dependencies: ['A'] }),
      baseItem({ id: 'C', dependencies: ['B'] }),
    ];
    const r = analyzeChangeRisk({ kind: 'engine', targetId: 'A' }, items);
    expect(r.blastRadius).toBe(2);
    expect(r.affectedDependents.sort()).toEqual(['B', 'C']);
  });
  it('marca observabilityImpact alto para telemetry_contract', () => {
    const r = analyzeChangeRisk({ kind: 'telemetry_contract' });
    expect(r.observabilityImpact).toBe('high');
  });
});

describe('computeDebtScore + computeArchitecturalRisk', () => {
  const findings: AuditFinding[] = [
    { code: 'parity_break', severity: 'high', itemId: 't', message: '', recommendation: '' },
    { code: 'dependency_cycle', severity: 'critical', itemId: 'c', message: '', recommendation: '' },
    { code: 'docs_drift', severity: 'low', itemId: 'd', message: '', recommendation: '' },
  ];
  it('debt tem banda monotônica e contributors ordenados', () => {
    const d = computeDebtScore(findings);
    expect(d.normalized).toBeGreaterThan(0);
    expect(d.contributors[0].weight).toBeGreaterThanOrEqual(d.contributors[d.contributors.length - 1].weight);
  });
  it('risco arquitetural amplifica ciclos e parity', () => {
    const r = computeArchitecturalRisk(findings);
    expect(r.score).toBeGreaterThan(0);
    expect(r.topCodes).toContain('dependency_cycle');
  });
});

describe('auditConsistency (integração leve)', () => {
  it('produz relatório com totais coerentes', () => {
    const rep = auditConsistency({
      tsThresholds: { regression_threshold: 20 },
      sqlThresholds: { regression_threshold: 25 },
      observedEvents: ['phase_enter'],
      expectedEvents: ['phase_enter', 'phase_complete'],
      declaredDashboardKeys: ['card.executive'],
      populatedDashboardKeys: [],
      usedItemIds: GOVERNANCE_REGISTRY.map((i) => i.id),
      engineTestCoverage: Object.fromEntries(
        GOVERNANCE_REGISTRY.filter((i) => i.kind === 'engine').map((i) => [i.id, true]),
      ),
    });
    expect(rep.totals.items).toBe(GOVERNANCE_REGISTRY.length);
    const sum = Object.values(rep.totals.bySeverity).reduce((a, b) => a + b, 0);
    expect(sum).toBe(rep.totals.findings);
    expect(rep.policy.allow_auto_fix).toBe(false);
  });
});

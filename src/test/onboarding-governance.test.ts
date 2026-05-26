import { describe, it, expect } from 'vitest';
import {
  GOVERNANCE_REGISTRY,
  REGISTRY_INDEX,
  getItem,
  listByKind,
  listByLifecycle,
} from '@/lib/onboarding/governanceRegistry';
import {
  analyzeChangeImpact,
  buildDependencyGraph,
  buildGovernanceSummary,
  canTransition,
  classifyVersionBump,
  compareVersions,
  computeBlastRadius,
  detectDrift,
  findDependents,
  generateOperationalDoc,
  parseVersion,
  simulateRollback,
  LIFECYCLE_TRANSITIONS,
} from '@/lib/onboarding/governanceAnalysis';

describe('registry consistency', () => {
  it('todo dependency referencia um id existente', () => {
    for (const it of GOVERNANCE_REGISTRY) {
      for (const dep of it.dependencies) {
        expect(REGISTRY_INDEX.has(dep), `dep ${dep} de ${it.id} não existe`).toBe(true);
      }
    }
  });
  it('ids são únicos', () => {
    const set = new Set<string>();
    for (const it of GOVERNANCE_REGISTRY) {
      expect(set.has(it.id)).toBe(false);
      set.add(it.id);
    }
  });
  it('helpers básicos funcionam', () => {
    expect(getItem('engine.business_impact')?.kind).toBe('engine');
    expect(listByKind('feature_flag').length).toBeGreaterThan(0);
    expect(listByLifecycle('active').length).toBeGreaterThan(0);
  });
});

describe('versioning', () => {
  it('parseVersion lida com semver e fallback', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, raw: '1.2.3' });
    expect(parseVersion('abc')).toEqual({ major: 0, minor: 0, patch: 0, raw: 'abc' });
  });
  it('compareVersions ordena corretamente', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });
  it('classifyVersionBump detecta major/minor/patch', () => {
    expect(classifyVersionBump('1.0.0', '2.0.0')).toBe('major');
    expect(classifyVersionBump('1.0.0', '1.1.0')).toBe('minor');
    expect(classifyVersionBump('1.0.0', '1.0.1')).toBe('patch');
    expect(classifyVersionBump('1.0.0', '1.0.0')).toBe('none');
  });
});

describe('dependency graph + blast radius', () => {
  it('buildDependencyGraph retorna arestas válidas', () => {
    const edges = buildDependencyGraph();
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      expect(REGISTRY_INDEX.has(e.from)).toBe(true);
      expect(REGISTRY_INDEX.has(e.to)).toBe(true);
    }
  });
  it('findDependents acha consumidores diretos', () => {
    const dep = findDependents('telemetry.onboarding_events');
    expect(dep.length).toBeGreaterThanOrEqual(3);
    expect(dep.find((d) => d.id === 'engine.regression_detector')).toBeTruthy();
  });
  it('computeBlastRadius é transitivo (telemetry → engines → dashboards)', () => {
    const br = computeBlastRadius('telemetry.onboarding_events');
    const ids = br.impacted.map((i) => i.id);
    expect(ids).toContain('engine.regression_detector');
    expect(ids).toContain('engine.behavioral_funnel');
    expect(br.estimated_severity === 'high' || br.estimated_severity === 'critical').toBe(true);
  });
  it('blast radius não loopa em ciclos hipotéticos', () => {
    const fake = [
      { ...GOVERNANCE_REGISTRY[0], id: 'a', dependencies: ['b'] },
      { ...GOVERNANCE_REGISTRY[0], id: 'b', dependencies: ['a'] },
    ];
    const br = computeBlastRadius('a', fake as any);
    expect(br.impacted.length).toBeLessThanOrEqual(2);
  });
});

describe('drift detection', () => {
  it('sem sinais, só reporta drifts estruturais (zero no registry atual)', () => {
    const d = detectDrift({ usage: {} });
    // Registry oficial não tem deps quebradas nem deprecated sem replace.
    expect(d.length).toBe(0);
  });
  it('detecta orphan_flag quando uso=0 e flag ativa', () => {
    const sig = { usage: { 'feature_flag.experiments_enabled': 0 } };
    const drift = detectDrift(sig);
    expect(drift.some((d) => d.kind === 'orphan_flag' && d.item_id === 'feature_flag.experiments_enabled')).toBe(true);
  });
  it('detecta dead_metric quando telemetry não tem eventos', () => {
    const drift = detectDrift({ usage: { 'telemetry.onboarding_events': 0 } });
    expect(drift.some((d) => d.kind === 'dead_metric')).toBe(true);
  });
  it('detecta unused_rpc/empty_dashboard', () => {
    const drift = detectDrift({ usage: { 'rpc.admin_onboarding_ops_funnel': 0, 'dashboard.onboarding_ops': 0 } });
    expect(drift.some((d) => d.kind === 'unused_rpc')).toBe(true);
    expect(drift.some((d) => d.kind === 'empty_dashboard')).toBe(true);
  });
  it('detecta dependência inexistente (stale_rule)', () => {
    const items = [{ ...GOVERNANCE_REGISTRY[0], id: 'x.broken', dependencies: ['ghost'] } as any];
    const drift = detectDrift({ usage: {} }, items);
    expect(drift.some((d) => d.kind === 'stale_rule')).toBe(true);
  });
});

describe('change impact analyzer', () => {
  it('disable de engine reporta consumers e itens dependentes', () => {
    const impact = analyzeChangeImpact('engine.regression_detector', 'disable');
    expect(impact.affected_items.length).toBeGreaterThanOrEqual(1);
    expect(impact.observability_loss.length).toBeGreaterThan(0);
    expect(impact.reversible).toBe(true);
  });
  it('remove agrava o risco vs disable', () => {
    const a = analyzeChangeImpact('telemetry.onboarding_events', 'disable');
    const b = analyzeChangeImpact('telemetry.onboarding_events', 'remove');
    const order = { low: 0, medium: 1, high: 2, critical: 3 };
    expect(order[b.estimated_risk]).toBeGreaterThanOrEqual(order[a.estimated_risk]);
    expect(b.reversible).toBe(false);
  });
  it('target inexistente retorna impacto vazio', () => {
    const impact = analyzeChangeImpact('does.not.exist', 'disable');
    expect(impact.affected_items).toEqual([]);
    expect(impact.estimated_risk).toBe('low');
  });
});

describe('lifecycle transitions', () => {
  it('transições válidas estão presentes', () => {
    expect(canTransition('experimental', 'active')).toBe(true);
    expect(canTransition('active', 'deprecated')).toBe(true);
    expect(canTransition('deprecated', 'archived')).toBe(true);
  });
  it('transições inválidas são rejeitadas', () => {
    expect(canTransition('archived', 'active')).toBe(false);
    expect(canTransition('experimental', 'stable')).toBe(false);
  });
  it('toda lifecycle é chave de LIFECYCLE_TRANSITIONS', () => {
    const states: any[] = ['experimental', 'active', 'stable', 'deprecated', 'disabled', 'archived'];
    for (const s of states) expect(LIFECYCLE_TRANSITIONS[s]).toBeDefined();
  });
});

describe('rollback simulation', () => {
  it('rollback de major emite warning', () => {
    const plan = simulateRollback('dashboard.onboarding_ops', '0.5.0');
    expect(plan.bump).toBe('major');
    expect(plan.warnings.length).toBeGreaterThan(0);
  });
  it('target mais novo que atual vira warning', () => {
    const plan = simulateRollback('engine.business_impact', '9.9.9');
    expect(plan.warnings.some((w) => w.includes('mais nova'))).toBe(true);
  });
  it('item desconhecido retorna não-reversível', () => {
    const plan = simulateRollback('ghost.id', '1.0.0');
    expect(plan.reversible).toBe(false);
  });
});

describe('summaries + doc', () => {
  it('buildGovernanceSummary agrega totals e top_risk', () => {
    const summary = buildGovernanceSummary([]);
    expect(Object.keys(summary.totals).length).toBeGreaterThan(0);
    expect(summary.top_risk.length).toBeGreaterThan(0);
    expect(summary.notes[0]).toMatch(/Sem drifts/);
  });
  it('summary reporta drift_count > 0', () => {
    const drift = detectDrift({ usage: { 'feature_flag.experiments_enabled': 0 } });
    const s = buildGovernanceSummary(drift);
    expect(s.drift_count).toBeGreaterThan(0);
  });
  it('generateOperationalDoc cobre todos os grupos com pelo menos 1 item', () => {
    const doc = generateOperationalDoc();
    expect(doc.sections.length).toBeGreaterThanOrEqual(8);
    for (const sec of doc.sections) {
      expect(sec.bullets.length).toBeGreaterThan(0);
    }
  });
});

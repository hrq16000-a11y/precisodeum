/**
 * Tests · Runtime Signal Integration Layer & Evidence Correlation
 */
import { describe, it, expect } from 'vitest';
import type { GovernanceItem } from '@/lib/onboarding/governanceRegistry';
import type { RuntimeEvent } from '@/lib/onboarding/runtimeGovernance';
import {
  EVIDENCE_POLICY,
  buildSignalLineage,
  buildEvidenceGraph,
  propagateConfidence,
  computeTruthScores,
  rankSourceReliability,
  detectEvidenceFindings,
  buildCoverageMatrix,
  auditCrossLayer,
  buildEvidenceReport,
} from '@/lib/onboarding/evidenceCorrelation';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

const REG: GovernanceItem[] = [
  {
    id: 'engine.alpha', kind: 'engine', title: 'Alpha', owner: 'x', version: '1.0.0',
    created_at: '', updated_at: '', lifecycle: 'active', risk_level: 'high',
    dependencies: ['threshold.alpha'], consumers: [], description: '',
  },
  {
    id: 'threshold.alpha', kind: 'threshold', title: 'Th Alpha', owner: 'x', version: '1.0.0',
    created_at: '', updated_at: '', lifecycle: 'active', risk_level: 'low',
    dependencies: [], consumers: [], description: '',
  },
  {
    id: 'feature_flag.beta', kind: 'feature_flag', title: 'Beta', owner: 'x', version: '1.0.0',
    created_at: '', updated_at: '', lifecycle: 'active', risk_level: 'low',
    dependencies: [], consumers: [], description: '',
  },
  {
    id: 'dashboard.gamma', kind: 'dashboard', title: 'Gamma', owner: 'x', version: '1.0.0',
    created_at: '', updated_at: '', lifecycle: 'stable', risk_level: 'low',
    dependencies: [], consumers: [], description: '',
  },
  {
    id: 'engine.deprecated_one', kind: 'engine', title: 'Deprecated', owner: 'x', version: '0.1.0',
    created_at: '', updated_at: '', lifecycle: 'deprecated', risk_level: 'low',
    dependencies: [], consumers: [], description: '',
  },
];

function ev(id: string, ts: number): RuntimeEvent {
  return { item_id: id, ts };
}

describe('EVIDENCE_POLICY', () => {
  it('is frozen and read-only by design', () => {
    expect(EVIDENCE_POLICY.read_only).toBe(true);
    expect(EVIDENCE_POLICY.allow_auto_fix).toBe(false);
    expect(Object.isFrozen(EVIDENCE_POLICY)).toBe(true);
  });
});

describe('buildSignalLineage', () => {
  it('marks observed when runtime events match exactly', () => {
    const events = Array.from({ length: 40 }, (_, i) => ev('engine.alpha', NOW - i * 1000));
    const lin = buildSignalLineage(events, { now: NOW }, REG);
    const alpha = lin.find((l) => l.item_id === 'engine.alpha')!;
    expect(alpha.provenance).toBe('observed');
    expect(alpha.signals.some((s) => s.source === 'runtime_event' && s.quality === 'strong')).toBe(true);
    expect(alpha.stale).toBe(false);
    expect(alpha.trust_band === 'high' || alpha.trust_band === 'medium').toBe(true);
  });

  it('marks empty registry-only items as declared', () => {
    const lin = buildSignalLineage([], { now: NOW }, REG);
    const beta = lin.find((l) => l.item_id === 'feature_flag.beta')!;
    expect(beta.provenance).toBe('declared');
    expect(beta.stale).toBe(true);
  });

  it('produces observed_proxy via token-match when event id is a substring', () => {
    const lin = buildSignalLineage(
      Array.from({ length: 10 }, (_, i) => ev('alpha', NOW - i * 100)),
      { now: NOW },
      REG,
    );
    const alpha = lin.find((l) => l.item_id === 'engine.alpha')!;
    expect(alpha.provenance).toBe('observed_proxy');
  });

  it('marks stale when last_seen older than stale_after_days', () => {
    const events = [ev('engine.alpha', NOW - 30 * DAY)];
    const lin = buildSignalLineage(events, { now: NOW, stale_after_days: 7 }, REG);
    const alpha = lin.find((l) => l.item_id === 'engine.alpha')!;
    expect(alpha.stale).toBe(true);
  });
});

describe('propagateConfidence', () => {
  it('downgrades a parent when its dependency is weak', () => {
    const lin = buildSignalLineage(
      Array.from({ length: 50 }, (_, i) => ev('engine.alpha', NOW - i * 1000)),
      { now: NOW },
      REG,
    );
    const prop = propagateConfidence(lin, REG);
    const alpha = prop.find((p) => p.item_id === 'engine.alpha')!;
    expect(alpha.effective).toBeLessThanOrEqual(alpha.original);
  });

  it('leaves leaves with no deps untouched', () => {
    const lin = buildSignalLineage([], { now: NOW }, REG);
    const prop = propagateConfidence(lin, REG);
    const th = prop.find((p) => p.item_id === 'threshold.alpha')!;
    expect(th.effective).toBeCloseTo(th.original, 5);
    expect(th.downgraded).toBe(false);
  });
});

describe('computeTruthScores', () => {
  it('scores observed items higher than declared-only', () => {
    const lin = buildSignalLineage(
      Array.from({ length: 60 }, (_, i) => ev('engine.alpha', NOW - i * 1000)),
      { now: NOW },
      REG,
    );
    const prop = propagateConfidence(lin, REG);
    const truth = computeTruthScores(lin, prop);
    const alpha = truth.find((t) => t.item_id === 'engine.alpha')!;
    const beta = truth.find((t) => t.item_id === 'feature_flag.beta')!;
    expect(alpha.score).toBeGreaterThan(beta.score);
  });

  it('stays inside [0,100]', () => {
    const lin = buildSignalLineage([], { now: NOW }, REG);
    const truth = computeTruthScores(lin, propagateConfidence(lin, REG));
    for (const t of truth) {
      expect(t.score).toBeGreaterThanOrEqual(0);
      expect(t.score).toBeLessThanOrEqual(100);
    }
  });
});

describe('rankSourceReliability', () => {
  it('ranks runtime_event above registry_static', () => {
    const lin = buildSignalLineage(
      Array.from({ length: 50 }, (_, i) => ev('engine.alpha', NOW - i * 1000)),
      { now: NOW },
      REG,
    );
    const rank = rankSourceReliability(lin);
    const rt = rank.find((r) => r.source === 'runtime_event')!;
    const reg = rank.find((r) => r.source === 'registry_static')!;
    expect(rt.reliability_score).toBeGreaterThan(reg.reliability_score);
  });
});

describe('detectEvidenceFindings', () => {
  it('emits contradiction when lifecycle=active but runtime is empty', () => {
    const lin = buildSignalLineage([], { now: NOW }, REG);
    const f = detectEvidenceFindings(lin, [], REG);
    expect(f.some((x) => x.kind === 'contradiction' && x.item_id === 'engine.alpha')).toBe(true);
  });

  it('emits orphan_telemetry for unknown events', () => {
    const f = detectEvidenceFindings(
      buildSignalLineage([], { now: NOW }, REG),
      [ev('totally_unknown_xyz', NOW)],
      REG,
    );
    expect(f.some((x) => x.kind === 'orphan_telemetry')).toBe(true);
  });

  it('emits blindspot for dashboards without observation', () => {
    const f = detectEvidenceFindings(buildSignalLineage([], { now: NOW }, REG), [], REG);
    expect(f.some((x) => x.kind === 'blindspot' && x.item_id === 'dashboard.gamma')).toBe(true);
  });

  it('emits broken_chain when dep is low-trust', () => {
    const lin = buildSignalLineage(
      Array.from({ length: 5 }, (_, i) => ev('engine.alpha', NOW - i * 1000)),
      { now: NOW },
      REG,
    );
    const f = detectEvidenceFindings(lin, [], REG);
    expect(f.some((x) => x.kind === 'broken_chain' && x.item_id === 'engine.alpha')).toBe(true);
  });
});

describe('buildCoverageMatrix', () => {
  it('groups by kind and computes coverage_ratio in [0,1]', () => {
    const lin = buildSignalLineage(
      Array.from({ length: 40 }, (_, i) => ev('engine.alpha', NOW - i * 1000)),
      { now: NOW },
      REG,
    );
    const cov = buildCoverageMatrix(lin);
    const engineRow = cov.find((c) => c.kind === 'engine')!;
    expect(engineRow.total).toBeGreaterThan(0);
    expect(engineRow.coverage_ratio).toBeGreaterThanOrEqual(0);
    expect(engineRow.coverage_ratio).toBeLessThanOrEqual(1);
  });
});

describe('auditCrossLayer', () => {
  it('flags over-declared for active items without runtime', () => {
    const lin = buildSignalLineage([], { now: NOW }, REG);
    const audit = auditCrossLayer(lin);
    const alpha = audit.find((a) => a.item_id === 'engine.alpha')!;
    expect(alpha.verdict).toBe('over-declared');
  });

  it('flags under-declared when deprecated items still observed', () => {
    const lin = buildSignalLineage(
      Array.from({ length: 30 }, (_, i) => ev('engine.deprecated_one', NOW - i * 1000)),
      { now: NOW },
      REG,
    );
    const audit = auditCrossLayer(lin);
    const dep = audit.find((a) => a.item_id === 'engine.deprecated_one')!;
    expect(dep.verdict).toBe('under-declared');
  });
});

describe('buildEvidenceReport', () => {
  it('returns a complete aggregate', () => {
    const events = Array.from({ length: 35 }, (_, i) => ev('engine.alpha', NOW - i * 1000));
    const rep = buildEvidenceReport(events, { now: NOW }, REG);
    expect(rep.lineage.length).toBe(REG.length);
    expect(rep.graph.nodes.length).toBe(REG.length);
    expect(rep.coverage.length).toBeGreaterThan(0);
    expect(rep.truth.length).toBe(REG.length);
  });
});

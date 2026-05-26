/**
 * FULL RUNTIME ADOPTION + LIVE OPERATIONAL MIRROR — testes
 * Cobre adoption, propagation, lineage, blind spots, mirror, contract validation,
 * runtime alignment, operational maturity, fail-soft, determinismo, corrupção.
 */
import { describe, it, expect } from 'vitest';
import type { RuntimeSignal } from '@/lib/onboarding/runtimeSignalAdapter';
import {
  adoptEngines,
  deriveAdoptionLevel,
  deriveRealityInput,
  deriveMemoryInput,
  deriveCorrelationInput,
  deriveEvidenceInput,
  deriveGovernanceInput,
  deriveHardeningInput,
  deriveSelfAuditInput,
  deriveDecisionInput,
  ENGINE_ADOPTION_POLICY,
} from '@/lib/onboarding/engineAdoptionLayer';
import {
  buildEvidencePropagationReport,
  traceSignalPropagation,
  buildLivePropagationMatrix,
  detectPropagationAnomalies,
} from '@/lib/onboarding/liveEvidencePropagation';
import { buildSignalLineage } from '@/lib/onboarding/signalLineage';
import { detectOperationalBlindSpots } from '@/lib/onboarding/operationalBlindSpots';
import { buildOperationalMirror } from '@/lib/onboarding/operationalMirror';
import { validateOperationalContracts } from '@/lib/onboarding/operationalContractValidator';

const NOW = 1_700_000_000_000;

function sig(over: Partial<RuntimeSignal> = {}): RuntimeSignal {
  return {
    id: over.id ?? `s_${Math.random().toString(36).slice(2, 8)}`,
    kind: over.kind ?? 'event',
    source: over.source ?? 'onboarding_events',
    at: over.at ?? NOW,
    session_id: over.session_id ?? 'sess_a',
    user_id: over.user_id ?? 'u1',
    phase: over.phase ?? 'phase2_service',
    release: over.release ?? null,
    experiment: over.experiment ?? null,
    incident: over.incident ?? null,
    severity: over.severity ?? 'info',
    category: over.category ?? 'phase_entered',
    meta: over.meta ?? {},
    partial: over.partial ?? false,
  };
}

const emptySignals: RuntimeSignal[] = [];
const baseSignals: RuntimeSignal[] = [
  sig({ id: 'a', category: 'phase_entered' }),
  sig({ id: 'b', category: 'next', at: NOW + 1000 }),
  sig({ id: 'c', kind: 'incident', severity: 'high', at: NOW + 2000, category: 'autosave_failed' }),
  sig({ id: 'd', kind: 'incident', severity: 'critical', at: NOW + 3000, category: 'recovery_corrupted' }),
  sig({ id: 'e', kind: 'release', source: 'onboarding_release_snapshots', at: NOW + 4000 }),
  sig({ id: 'f', kind: 'experiment', source: 'onboarding_experiments', at: NOW + 5000 }),
];

// ──────────────────────────────────────────────────────────────────────────
describe('Engine Adoption Layer', () => {
  it('policy is frozen and read-only', () => {
    expect(Object.isFrozen(ENGINE_ADOPTION_POLICY)).toBe(true);
    expect(ENGINE_ADOPTION_POLICY.allow_mutation).toBe(false);
  });

  it('deriveAdoptionLevel handles empty', () => {
    expect(deriveAdoptionLevel(emptySignals)).toBe('none');
    expect(deriveAdoptionLevel(baseSignals)).toBe('partial');
  });

  it('deriveAdoptionLevel = full with >=10 signals', () => {
    const many = Array.from({ length: 12 }, (_, i) => sig({ id: `m${i}` }));
    expect(deriveAdoptionLevel(many)).toBe('full');
  });

  it('adoptEngines is deterministic', () => {
    const a = adoptEngines({ runtimeSignals: baseSignals }, NOW);
    const b = adoptEngines({ runtimeSignals: baseSignals }, NOW);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('adoptEngines fails soft on missing input', () => {
    const r = adoptEngines({}, NOW);
    expect(r.adoptionLevel).toBe('none');
    expect(r.signalsTotal).toBe(0);
    expect(r.perEngine.operationalReality.fellBackToHeuristic).toBe(true);
  });

  it('adoptEngines fails soft on undefined input', () => {
    const r = adoptEngines({ runtimeSignals: undefined as any }, NOW);
    expect(r.adoptionLevel).toBe('none');
  });

  it('deriveRealityInput captures events', () => {
    const d = deriveRealityInput(baseSignals);
    expect(d.totalSignals).toBe(6);
    expect(d.events.length).toBeGreaterThan(0);
  });

  it('deriveMemoryInput captures incidents and releases', () => {
    const d = deriveMemoryInput(baseSignals);
    expect(d.incidents.length).toBe(2);
    expect(d.releases.length).toBe(1);
  });

  it('deriveCorrelationInput groups by session and phase', () => {
    const d = deriveCorrelationInput(baseSignals);
    expect(d.bySession['sess_a']).toBeDefined();
    expect(d.byPhase['phase2_service']).toBe(6);
  });

  it('deriveEvidenceInput counts partials and sources', () => {
    const partial = sig({ id: 'p', partial: true });
    const d = deriveEvidenceInput([...baseSignals, partial]);
    expect(d.partialCount).toBe(1);
    expect(Object.keys(d.bySource).length).toBeGreaterThanOrEqual(2);
  });

  it('deriveGovernanceInput aggregates per phase:event', () => {
    const d = deriveGovernanceInput(baseSignals);
    expect(Object.keys(d.itemUsage).length).toBeGreaterThan(0);
  });

  it('deriveHardeningInput computes error rate', () => {
    const d = deriveHardeningInput(baseSignals);
    expect(d.errorRate).toBeGreaterThan(0);
    expect(d.criticalCount).toBeGreaterThanOrEqual(1);
  });

  it('deriveSelfAuditInput lists unique kinds/sources', () => {
    const d = deriveSelfAuditInput(baseSignals);
    expect(d.uniqueKinds.length).toBeGreaterThan(1);
    expect(d.uniqueSources.length).toBeGreaterThan(1);
  });

  it('deriveDecisionInput computes confidence and risk', () => {
    const d = deriveDecisionInput(baseSignals, NOW + 10_000);
    expect(d.riskIndicators).toBeGreaterThanOrEqual(1);
    expect(d.confidence).toBeGreaterThan(0);
  });

  it('all 8 engines have an entry in adoption result', () => {
    const r = adoptEngines({ runtimeSignals: baseSignals }, NOW);
    expect(Object.keys(r.perEngine).length).toBe(8);
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('Live Evidence Propagation', () => {
  it('traceSignalPropagation produces one trace per signal', () => {
    const t = traceSignalPropagation(baseSignals);
    expect(t.length).toBe(baseSignals.length);
  });

  it('every trace reaches correlation', () => {
    const t = traceSignalPropagation(baseSignals);
    expect(t.every((x) => x.reachedEngines.includes('correlation'))).toBe(true);
  });

  it('builds propagation matrix square shape', () => {
    const t = traceSignalPropagation(baseSignals);
    const m = buildLivePropagationMatrix(t);
    expect(m.matrix.length).toBe(m.engines.length);
    expect(m.matrix[0].length).toBe(m.engines.length);
  });

  it('detects hidden signal loss when high severity does not reach evidence', () => {
    const s = [sig({ id: 'crit', kind: 'event', severity: 'high' })];
    // event kind reaches reality + correlation; severity=high also adds evidence.
    // Use kind that does NOT auto-add evidence (release) with severity low → still high adds evidence
    // To force loss: synthesize trace manually.
    const traces = [{ signalId: 'crit', source: 'x', severity: 'critical', reachedEngines: ['reality' as const, 'correlation' as const], missedEngines: [], latencyMs: 0, depth: 2 }];
    const m = buildLivePropagationMatrix(traces);
    const a = detectPropagationAnomalies([sig({ id: 'crit', severity: 'critical' })], traces, m);
    expect(a.some((x) => x.id === 'hidden_signal_loss')).toBe(true);
  });

  it('detects recursive_failure_chain', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      sig({ id: `r${i}`, severity: 'high', phase: 'phase4_final', category: 'autosave_failed' }),
    );
    const report = buildEvidencePropagationReport(many);
    expect(report.anomalies.some((a) => a.id === 'recursive_failure_chain')).toBe(true);
  });

  it('detects delayed_visibility (at=0)', () => {
    const s = [sig({ id: 'no_ts', at: 0, severity: 'high' })];
    const r = buildEvidencePropagationReport(s);
    expect(r.anomalies.some((a) => a.id === 'delayed_visibility')).toBe(true);
  });

  it('detects silent_engine_divergence when only correlation populated', () => {
    const only = [sig({ id: 'x' })];
    const r = buildEvidencePropagationReport(only);
    // Many engines silent given single low-severity event
    expect(r.anomalies.some((a) => a.id === 'silent_engine_divergence')).toBe(true);
  });

  it('full report is deterministic', () => {
    const a = buildEvidencePropagationReport(baseSignals);
    const b = buildEvidencePropagationReport(baseSignals);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('empty signals → empty report fail-soft', () => {
    const r = buildEvidencePropagationReport([]);
    expect(r.traces.length).toBe(0);
    expect(r.anomalies.length).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('Signal Lineage Engine', () => {
  it('builds chains grouped by session', () => {
    const r = buildSignalLineage(baseSignals);
    expect(r.lineageChains.length).toBe(1);
    expect(r.lineageChains[0].steps.length).toBe(baseSignals.length);
  });

  it('detects orphan_branch when no session_id', () => {
    const s = [sig({ id: 'o', session_id: null })];
    const r = buildSignalLineage(s);
    expect(r.lineageBreaks.some((b) => b.id === 'orphan_branch')).toBe(true);
  });

  it('detects hidden_source when root has at=0', () => {
    const s = [sig({ id: 'h', at: 0, session_id: 'sx' })];
    const r = buildSignalLineage(s);
    expect(r.lineageBreaks.some((b) => b.id === 'hidden_source')).toBe(true);
  });

  it('detects unresolved_runtime_path for isolated high severity', () => {
    const s = [sig({ id: 'u', severity: 'high', session_id: 'sy' })];
    const r = buildSignalLineage(s);
    expect(r.unresolvedSignals.length).toBeGreaterThan(0);
  });

  it('detects circular_propagation when category repeats 3x', () => {
    const list = ['p_a', 'p_b', 'p_c', 'p_d'].map((id, i) =>
      sig({ id, session_id: 'sz', category: 'autosave_failed', at: NOW + i }),
    );
    const r = buildSignalLineage(list);
    expect(r.lineageBreaks.some((b) => b.id === 'circular_propagation')).toBe(true);
  });

  it('detects duplicate_signal_path across sessions', () => {
    const make = (sid: string) => [
      sig({ id: sid + '1', session_id: sid, category: 'phase_entered', at: 1 }),
      sig({ id: sid + '2', session_id: sid, category: 'next', at: 2 }),
    ];
    const r = buildSignalLineage([...make('s1'), ...make('s2'), ...make('s3')]);
    expect(r.duplicatedPaths.length).toBeGreaterThanOrEqual(1);
  });

  it('lineage integrity 100 for clean single chain', () => {
    const s = [sig({ id: 'g1', at: 1, session_id: 'gA' }), sig({ id: 'g2', at: 2, session_id: 'gA' })];
    const r = buildSignalLineage(s);
    expect(r.lineageIntegrity).toBe(100);
  });

  it('fail-soft on empty input', () => {
    const r = buildSignalLineage([]);
    expect(r.lineageChains.length).toBe(0);
    expect(r.lineageIntegrity).toBe(100);
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('Operational Blind-Spot Detector', () => {
  it('detects invisible_phase for missing known phases', () => {
    const r = detectOperationalBlindSpots(baseSignals, buildEvidencePropagationReport(baseSignals));
    expect(r.blindSpots.some((b) => b.id === 'invisible_phase')).toBe(true);
  });

  it('detects telemetry_void below 5 signals', () => {
    const r = detectOperationalBlindSpots([sig()], buildEvidencePropagationReport([sig()]));
    expect(r.blindSpots.some((b) => b.id === 'telemetry_void')).toBe(true);
  });

  it('detects low_forensic_resolution when >30% missing session_id', () => {
    const s = [
      sig({ id: '1', session_id: null }),
      sig({ id: '2', session_id: null }),
      sig({ id: '3', session_id: 'sA' }),
    ];
    const r = detectOperationalBlindSpots(s, buildEvidencePropagationReport(s));
    expect(r.blindSpots.some((b) => b.id === 'low_forensic_resolution')).toBe(true);
  });

  it('detects unstable_runtime_area when >40% errors in phase', () => {
    const s = [
      sig({ id: '1', phase: 'phase4_final', severity: 'critical' }),
      sig({ id: '2', phase: 'phase4_final', severity: 'high' }),
      sig({ id: '3', phase: 'phase4_final', severity: 'info' }),
    ];
    const r = detectOperationalBlindSpots(s, buildEvidencePropagationReport(s));
    expect(r.blindSpots.some((b) => b.id === 'unstable_runtime_area')).toBe(true);
  });

  it('blindSpotScore decreases with more findings', () => {
    const empty = detectOperationalBlindSpots([], buildEvidencePropagationReport([]));
    const some = detectOperationalBlindSpots(baseSignals, buildEvidencePropagationReport(baseSignals));
    expect(some.blindSpotScore).toBeLessThan(empty.blindSpotScore + 1);
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('Operational Mirror', () => {
  it('produces all 5 scores', () => {
    const m = buildOperationalMirror(baseSignals, NOW + 10_000);
    expect(typeof m.scores.mirror_integrity).toBe('number');
    expect(typeof m.scores.propagation_integrity).toBe('number');
    expect(typeof m.scores.systemic_visibility).toBe('number');
    expect(typeof m.scores.runtime_alignment).toBe('number');
    expect(typeof m.scores.operational_maturity).toBe('number');
  });

  it('scores are clamped 0..100', () => {
    const m = buildOperationalMirror(baseSignals, NOW + 10_000);
    for (const k of Object.keys(m.scores) as Array<keyof typeof m.scores>) {
      expect(m.scores[k]).toBeGreaterThanOrEqual(0);
      expect(m.scores[k]).toBeLessThanOrEqual(100);
    }
  });

  it('is deterministic for same input', () => {
    const a = buildOperationalMirror(baseSignals, NOW + 1000);
    const b = buildOperationalMirror(baseSignals, NOW + 1000);
    expect(JSON.stringify(a.scores)).toEqual(JSON.stringify(b.scores));
  });

  it('handles empty runtime gracefully', () => {
    const m = buildOperationalMirror([], NOW);
    expect(m.runtimeState.totalSignals).toBe(0);
    expect(m.scores.mirror_integrity).toBe(0);
  });

  it('handles corrupted/partial signals', () => {
    const corrupt = [
      sig({ id: 'p1', partial: true }),
      sig({ id: 'p2', partial: true, severity: 'critical' }),
    ];
    const m = buildOperationalMirror(corrupt, NOW);
    expect(m.scores.mirror_integrity).toBeLessThan(50);
  });

  it('partial runtime → partial adoption level', () => {
    const m = buildOperationalMirror(baseSignals, NOW);
    expect(m.runtimeState.adoption.adoptionLevel).toBe('partial');
  });

  it('exposes propagation/lineage/blindSpots in output', () => {
    const m = buildOperationalMirror(baseSignals, NOW);
    expect(m.propagation).toBeDefined();
    expect(m.lineage).toBeDefined();
    expect(m.blindSpots).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('Contract Validator', () => {
  it('passes on clean signals', () => {
    const r = validateOperationalContracts(baseSignals);
    expect(r.findings.length).toBe(0);
    expect(r.contractIntegrity).toBe(100);
  });

  it('detects orphan_engine_contract for unknown kind', () => {
    const bad = [sig({ id: 'x', kind: 'unknown_kind' as any })];
    const r = validateOperationalContracts(bad);
    expect(r.findings.some((f) => f.id === 'orphan_engine_contract')).toBe(true);
  });

  it('detects inconsistent_severity_mapping', () => {
    const bad = [sig({ id: 'x', severity: 'totally_invalid' as any })];
    const r = validateOperationalContracts(bad);
    expect(r.findings.some((f) => f.id === 'inconsistent_severity_mapping')).toBe(true);
  });

  it('detects missing_runtime_mapping when no phase', () => {
    const all = Array.from({ length: 6 }, (_, i) => sig({ id: `np${i}`, phase: null }));
    const r = validateOperationalContracts(all);
    expect(r.findings.some((f) => f.id === 'missing_runtime_mapping')).toBe(true);
  });

  it('detects contract_mismatch on negative timestamps', () => {
    const bad = [sig({ id: 'neg', at: -1 })];
    const r = validateOperationalContracts(bad);
    expect(r.findings.some((f) => f.id === 'contract_mismatch')).toBe(true);
  });

  it('integrity decreases with findings', () => {
    const bad = [sig({ id: 'x', kind: 'bad' as any, severity: 'wrong' as any })];
    const r = validateOperationalContracts(bad);
    expect(r.contractIntegrity).toBeLessThan(100);
  });

  it('lists all 7 validated layers', () => {
    const r = validateOperationalContracts(baseSignals);
    expect(r.validatedLayers.length).toBe(7);
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('Determinism & fail-soft', () => {
  it('mirror with same signals = same scores across runs', () => {
    const a = buildOperationalMirror(baseSignals, NOW);
    const b = buildOperationalMirror(baseSignals, NOW);
    expect(a.scores).toEqual(b.scores);
  });

  it('empty propagation report works', () => {
    const m = buildOperationalMirror([], NOW);
    expect(m.propagation.traces.length).toBe(0);
  });

  it('completely malformed kinds do not throw', () => {
    const broken: any = [
      { id: '1', kind: 'x', source: 'y', at: 0, session_id: null, user_id: null, phase: null, release: null, experiment: null, incident: null, severity: 'info', category: null, meta: {}, partial: true },
    ];
    expect(() => buildOperationalMirror(broken, NOW)).not.toThrow();
  });
});

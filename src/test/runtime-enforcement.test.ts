/**
 * Fase 1.8.7 — Runtime Enforcement tests (READ-ONLY).
 * 35+ deterministic tests.
 */

import { describe, expect, it } from 'vitest';
import {
  ENFORCEMENT_AUDIT_ACTIONS,
  adaptLayersToBoundaries,
  aggregateBoundaryLocks,
  aggregateEnforcement,
  aggregateViolations,
  analyzeDependencyEnforcement,
  analyzeEnforcementTopology,
  assertAllEnforcementIntegrity,
  assertEnforcementCertificationIntegrity,
  assertEnforcementCoverage,
  assertEnforcementDeterminism,
  assertEnforcementTopologyIntegrity,
  assertNoBoundaryEscape,
  assertNoImplicitMutation,
  assertNoRecursiveDependency,
  assertNoUnsafeRuntimeActivation,
  assertRuntimeLockdownInvariant,
  buildBoundary,
  buildEnforcementAuditPayload,
  buildEnforcementCertification,
  buildEnforcementRanking,
  buildEnvelope,
  buildRuntimeLockdown,
  calculateEnforcementConfidence,
  classifyBoundaryEnforcement,
  classifyEnforcementSafety,
  collectBoundaryViolations,
  deriveEnforcement,
  detectBoundaryEscape,
  detectCertificationFailure,
  detectCrossLayerMutation,
  detectDependencyLeak,
  detectHiddenDependencyMutation,
  detectImplicitMutation,
  detectPromotionOverride,
  detectRecursiveDependency,
  detectRecursiveRuntimeDependency,
  detectRecursiveTopology,
  detectRuntimeUnlock,
  detectTopologyMutationRisk,
  detectUnsafeBoundaryActivation,
  detectUnsafeDependency,
  detectUnsafeRuntimeActivation,
  detectUnsafeTopology,
  explainEnforcement,
  explainEnforcementCertification,
  explainEnforcementTopology,
  explainEnforcementViolation,
  explainLockdown,
  isEnforcementAuditPayloadPiiFree,
  rankEnforcementCertification,
  rankTopologyEnforcementRisk,
  summarizeEnforcementHealth,
} from '@/lib/runtimeEnforcement';
import type {
  EnforcementBoundary,
  RuntimeEnforcement,
} from '@/lib/runtimeEnforcement';

const FLOW = 'flow_a' as any;
const FLOW_B = 'flow_b' as any;

function safeBoundary(): EnforcementBoundary {
  return buildBoundary({ flow: FLOW, layer: 'isolation' });
}

function envelopeWith(violations: number, classification: RuntimeEnforcement['classification'] = 'LOCKED') {
  const enforcement: RuntimeEnforcement = {
    flow: FLOW,
    classification,
    severity: violations > 0 ? 'HIGH' : 'NONE',
    boundaries: [safeBoundary()],
    violations: Array.from({ length: violations }, (_, i) => ({
      flow: FLOW, layer: 'isolation', type: 'implicit_mutation',
      severity: 'HIGH', detail: `v${i}`,
    } as const)),
    invariants: [],
    lockdown: classification === 'BLOCKED' ? 'collapsed' : 'fully_locked',
  };
  return buildEnvelope(enforcement);
}

describe('1.8.7 — boundary enforcement', () => {
  it('A. classify safe boundary as LOCKED', () => {
    expect(classifyBoundaryEnforcement({ flow: FLOW, layer: 'isolation' })).toBe('LOCKED');
  });

  it('B. classify live execution as BLOCKED', () => {
    expect(classifyBoundaryEnforcement({ flow: FLOW, layer: 'isolation', liveExecutionEnabled: true })).toBe('BLOCKED');
  });

  it('C. classify retry as BLOCKED', () => {
    expect(classifyBoundaryEnforcement({ flow: FLOW, layer: 'isolation', retryEnabled: true })).toBe('BLOCKED');
  });

  it('D. classify wrong stage as RESTRICTED', () => {
    expect(classifyBoundaryEnforcement({ flow: FLOW, layer: 'isolation', currentStage: 'STAGE_1' })).toBe('RESTRICTED');
  });

  it('E. implicit mutation as RESTRICTED', () => {
    expect(classifyBoundaryEnforcement({ flow: FLOW, layer: 'isolation', implicitMutation: true })).toBe('RESTRICTED');
  });

  it('F. boundary built has locked invariants', () => {
    const b = safeBoundary();
    expect(b.liveExecutionEnabled).toBe(false);
    expect(b.retryEnabled).toBe(false);
    expect(b.backgroundEnabled).toBe(false);
    expect(b.realUsersAllowed).toBe(false);
    expect(b.currentStage).toBe('STAGE_0_READ_ONLY');
  });

  it('G. detect boundary escape', () => {
    expect(detectBoundaryEscape({ flow: FLOW, layer: 'isolation', liveExecutionEnabled: true })?.severity).toBe('CRITICAL');
    expect(detectBoundaryEscape({ flow: FLOW, layer: 'isolation' })).toBeNull();
  });

  it('H. detect implicit mutation', () => {
    expect(detectImplicitMutation({ flow: FLOW, layer: 'isolation', implicitMutation: true })?.severity).toBe('HIGH');
  });

  it('I. detect cross-layer mutation', () => {
    expect(detectCrossLayerMutation({ flow: FLOW, layer: 'isolation', crossLayerMutation: true })?.type).toBe('cross_layer_mutation');
  });

  it('J. detect unsafe boundary activation (retry critical)', () => {
    expect(detectUnsafeBoundaryActivation({ flow: FLOW, layer: 'isolation', retryEnabled: true })?.severity).toBe('CRITICAL');
  });

  it('K. collectBoundaryViolations aggregates', () => {
    const vs = collectBoundaryViolations({ flow: FLOW, layer: 'isolation', liveExecutionEnabled: true, implicitMutation: true });
    expect(vs.length).toBeGreaterThanOrEqual(2);
  });
});

describe('1.8.7 — runtime lockdown', () => {
  it('L. fully locked when all boundaries locked', () => {
    const ld = buildRuntimeLockdown({ flow: FLOW, boundaries: [safeBoundary(), safeBoundary()] });
    expect(ld).toBe('fully_locked');
  });

  it('M. collapsed when blocked boundary', () => {
    const b = buildBoundary({ flow: FLOW, layer: 'isolation', liveExecutionEnabled: true });
    expect(buildRuntimeLockdown({ flow: FLOW, boundaries: [b] })).toBe('collapsed');
  });

  it('N. unsafe when recursive', () => {
    expect(buildRuntimeLockdown({ flow: FLOW, boundaries: [safeBoundary()], recursive: true })).toBe('unsafe');
  });

  it('O. restricted when boundary restricted', () => {
    const b = buildBoundary({ flow: FLOW, layer: 'isolation', currentStage: 'STAGE_1' });
    expect(buildRuntimeLockdown({ flow: FLOW, boundaries: [b] })).toBe('restricted');
  });

  it('P. detect runtime unlock when blocked but unlocked', () => {
    const v = detectRuntimeUnlock({
      flow: FLOW,
      boundaries: [{ ...safeBoundary(), classification: 'BLOCKED', locked: false } as any],
    });
    expect(v?.severity).toBe('CRITICAL');
  });

  it('Q. detect unsafe runtime activation', () => {
    expect(detectUnsafeRuntimeActivation({ flow: FLOW, boundaries: [safeBoundary()], unsafeActivation: true })?.type)
      .toBe('runtime_activation');
  });

  it('R. detect promotion override', () => {
    expect(detectPromotionOverride({ flow: FLOW, boundaries: [safeBoundary()], promotionOverride: true })?.type)
      .toBe('promotion_override');
  });

  it('S. detect recursive runtime dependency', () => {
    expect(detectRecursiveRuntimeDependency({ flow: FLOW, boundaries: [safeBoundary()], recursive: true })?.type)
      .toBe('recursive_runtime');
  });
});

describe('1.8.7 — dependency enforcement', () => {
  it('T. analyzeDependencyEnforcement no edges', () => {
    const r = analyzeDependencyEnforcement({ flow: FLOW, edges: [] });
    expect(r.totalEdges).toBe(0);
    expect(r.recursive).toBe(false);
  });

  it('U. detect unsafe dependency (mutating)', () => {
    expect(detectUnsafeDependency({ flow: FLOW, edges: [{ from: 'isolation', to: 'integrity', mutating: true }] })?.severity)
      .toBe('HIGH');
  });

  it('V. detect dependency leak (hidden)', () => {
    expect(detectDependencyLeak({ flow: FLOW, edges: [{ from: 'isolation', to: 'integrity', hidden: true }] })?.severity)
      .toBe('MEDIUM');
  });

  it('W. detect recursive dependency cycle', () => {
    const edges = [
      { from: 'isolation' as const, to: 'integrity' as const },
      { from: 'integrity' as const, to: 'isolation' as const },
    ];
    expect(detectRecursiveDependency({ flow: FLOW, edges })?.type).toBe('recursive_runtime');
  });

  it('X. detect hidden mutation', () => {
    expect(detectHiddenDependencyMutation({ flow: FLOW, edges: [{ from: 'isolation', to: 'integrity', hidden: true, mutating: true }] })?.severity)
      .toBe('HIGH');
  });

  it('Y. assertNoRecursiveDependency triggers', () => {
    const a = analyzeDependencyEnforcement({
      flow: FLOW,
      edges: [{ from: 'isolation', to: 'integrity' }, { from: 'integrity', to: 'isolation' }],
    });
    expect(assertNoRecursiveDependency(a).length).toBe(1);
  });
});

describe('1.8.7 — topology enforcement', () => {
  it('Z. analyzeEnforcementTopology safe', () => {
    const t = analyzeEnforcementTopology({ flow: FLOW, boundaries: [safeBoundary()] });
    expect(t.layers).toBe(1);
    expect(t.violations.length).toBe(0);
  });

  it('AA. detect unsafe topology when overlaps>2', () => {
    expect(detectUnsafeTopology({ flow: FLOW, boundaries: [safeBoundary()], overlaps: 5 })?.severity).toBe('HIGH');
  });

  it('AB. detect recursive topology', () => {
    expect(detectRecursiveTopology({ flow: FLOW, boundaries: [safeBoundary()], recursive: true })?.type)
      .toBe('recursive_runtime');
  });

  it('AC. detect topology mutation risk', () => {
    expect(detectTopologyMutationRisk({ flow: FLOW, boundaries: [safeBoundary()], mutationRisk: true })?.severity)
      .toBe('MEDIUM');
  });

  it('AD. rank topology risk critical when recursive', () => {
    const t = analyzeEnforcementTopology({ flow: FLOW, boundaries: [safeBoundary()], recursive: true });
    expect(rankTopologyEnforcementRisk(t)).toBe('CRITICAL');
  });
});

describe('1.8.7 — certification', () => {
  it('AE. classify full safety when no violations', () => {
    const e = envelopeWith(0, 'LOCKED').enforcement;
    expect(classifyEnforcementSafety({ flow: FLOW, enforcement: e })).toBe('FULL');
  });

  it('AF. classify blocked when live execution', () => {
    const e = envelopeWith(0).enforcement;
    expect(classifyEnforcementSafety({ flow: FLOW, enforcement: e, liveExecutionEnabled: true })).toBe('BLOCKED');
  });

  it('AG. classify conditional on stage mismatch', () => {
    const e = envelopeWith(0).enforcement;
    expect(classifyEnforcementSafety({ flow: FLOW, enforcement: e, currentStage: 'STAGE_1' })).toBe('CONDITIONAL');
  });

  it('AH. confidence drops on violations', () => {
    const e = envelopeWith(3, 'RESTRICTED').enforcement;
    const c = calculateEnforcementConfidence({ flow: FLOW, enforcement: e });
    expect(c).toBeLessThan(1);
  });

  it('AI. confidence zero on live execution', () => {
    const e = envelopeWith(0).enforcement;
    expect(calculateEnforcementConfidence({ flow: FLOW, enforcement: e, liveExecutionEnabled: true })).toBe(0);
  });

  it('AJ. buildEnforcementCertification certified true on FULL', () => {
    const e = envelopeWith(0).enforcement;
    const c = buildEnforcementCertification({ flow: FLOW, enforcement: e });
    expect(c.certified).toBe(true);
    expect(c.level).toBe('FULL');
  });

  it('AK. detectCertificationFailure on blocked', () => {
    const e = envelopeWith(0).enforcement;
    expect(detectCertificationFailure({ flow: FLOW, enforcement: e, retryEnabled: true })).toBe(true);
  });

  it('AL. rankEnforcementCertification sorts FULL first', () => {
    const e = envelopeWith(0).enforcement;
    const full = buildEnforcementCertification({ flow: FLOW, enforcement: e });
    const blocked = buildEnforcementCertification({ flow: FLOW_B, enforcement: e, liveExecutionEnabled: true });
    const ranked = rankEnforcementCertification([blocked, full]);
    expect(ranked[0].level).toBe('FULL');
  });
});

describe('1.8.7 — aggregation', () => {
  it('AM. aggregateEnforcement counts classifications', () => {
    const agg = aggregateEnforcement([envelopeWith(0, 'LOCKED'), envelopeWith(2, 'RESTRICTED')]);
    expect(agg.flows).toBe(2);
    expect(agg.locked + agg.restricted).toBe(2);
  });

  it('AN. aggregateViolations flattens', () => {
    expect(aggregateViolations([envelopeWith(2)]).length).toBe(2);
  });

  it('AO. aggregateBoundaryLocks returns locked boundaries', () => {
    expect(aggregateBoundaryLocks([envelopeWith(0)]).length).toBeGreaterThanOrEqual(1);
  });

  it('AP. summarizeEnforcementHealth healthy when no blocked', () => {
    const s = summarizeEnforcementHealth([envelopeWith(0, 'LOCKED')]);
    expect(s.healthy).toBe(true);
  });

  it('AQ. buildEnforcementRanking puts LOCKED before BLOCKED', () => {
    const r = buildEnforcementRanking([envelopeWith(0, 'BLOCKED'), envelopeWith(0, 'LOCKED')]);
    expect(r[0].enforcement.classification).toBe('LOCKED');
  });

  it('AR. deriveEnforcement marks CRITICAL violation as BLOCKED', () => {
    const e = deriveEnforcement(FLOW, [safeBoundary()], [
      { flow: FLOW, layer: 'isolation', type: 'boundary_escape', severity: 'CRITICAL', detail: 'x' },
    ], [], 'collapsed');
    expect(e.classification).toBe('BLOCKED');
  });

  it('AS. envelope holds read-only invariants', () => {
    const env = envelopeWith(0);
    expect(env.liveExecutionEnabled).toBe(false);
    expect(env.retryEnabled).toBe(false);
    expect(env.backgroundEnabled).toBe(false);
    expect(env.realUsersAllowed).toBe(false);
    expect(env.currentStage).toBe('STAGE_0_READ_ONLY');
  });
});

describe('1.8.7 — adapters & observability', () => {
  it('AT. adaptLayersToBoundaries inert', () => {
    const bs = adaptLayersToBoundaries({
      flow: FLOW,
      isolation: {}, integrity: {}, stability: {},
    });
    expect(bs.length).toBe(3);
    expect(bs.every(b => b.liveExecutionEnabled === false)).toBe(true);
  });

  it('AU. observability strips PII keys', () => {
    const p = buildEnforcementAuditPayload('runtime_enforcement_generated', FLOW, {
      email: 'a@b.com', flow_safe: 'ok',
    } as any);
    expect('email' in p.metadata).toBe(false);
    expect(p.metadata.flow_safe).toBe('ok');
  });

  it('AV. observability detects unsafe payloads as not PII-free', () => {
    const p = { action: 'runtime_enforcement_generated' as const, flow: FLOW, metadata: { url: 'https://a.com' } };
    expect(isEnforcementAuditPayloadPiiFree(p)).toBe(false);
  });

  it('AW. ENFORCEMENT_AUDIT_ACTIONS exposes 7 actions', () => {
    expect(ENFORCEMENT_AUDIT_ACTIONS.length).toBe(7);
  });
});

describe('1.8.7 — guards & integrity', () => {
  it('AX. assertEnforcementCoverage fails on empty', () => {
    expect(assertEnforcementCoverage([]).length).toBeGreaterThan(0);
  });

  it('AY. assertNoBoundaryEscape catches runtime activation', () => {
    const e = envelopeWith(0).enforcement;
    const tainted: RuntimeEnforcement = {
      ...e,
      violations: [{ flow: FLOW, layer: 'isolation', type: 'boundary_escape', severity: 'CRITICAL', detail: 'x' }],
    };
    expect(assertNoBoundaryEscape(tainted).length).toBe(1);
  });

  it('AZ. assertNoImplicitMutation triggers', () => {
    const tainted = envelopeWith(1).enforcement;
    expect(assertNoImplicitMutation(tainted).length).toBe(1);
  });

  it('BA. assertNoUnsafeRuntimeActivation safe on read-only envelope', () => {
    expect(assertNoUnsafeRuntimeActivation(envelopeWith(0)).length).toBe(0);
  });

  it('BB. assertEnforcementDeterminism flags divergence', () => {
    const a = envelopeWith(0);
    const b = envelopeWith(3, 'RESTRICTED');
    expect(assertEnforcementDeterminism(a, b).length).toBe(1);
  });

  it('BC. assertRuntimeLockdownInvariant ok on consistent', () => {
    expect(assertRuntimeLockdownInvariant(envelopeWith(0).enforcement).length).toBe(0);
  });

  it('BD. assertEnforcementTopologyIntegrity recursive triggers', () => {
    const t = analyzeEnforcementTopology({ flow: FLOW, boundaries: [safeBoundary()], recursive: true, overlaps: 5 });
    expect(assertEnforcementTopologyIntegrity(t).length).toBeGreaterThanOrEqual(2);
  });

  it('BE. assertEnforcementCertificationIntegrity catches mismatch', () => {
    expect(assertEnforcementCertificationIntegrity({
      flow: FLOW, level: 'BLOCKED', confidence: 1, certified: true, reasons: [],
    }).length).toBe(1);
  });

  it('BF. assertAllEnforcementIntegrity composes', () => {
    expect(assertAllEnforcementIntegrity([envelopeWith(0)]).length).toBe(0);
  });
});

describe('1.8.7 — explainers', () => {
  it('BG. explainEnforcement returns deterministic string', () => {
    const e = envelopeWith(0).enforcement;
    expect(explainEnforcement(e)).toContain('enforcement[');
  });

  it('BH. explainLockdown returns string', () => {
    expect(explainLockdown('fully_locked')).toBe('lockdown=fully_locked');
  });

  it('BI. explainViolation/Topology/Certification produce strings', () => {
    const e = envelopeWith(1).enforcement;
    expect(explainEnforcementViolation(e.violations[0])).toContain('violation[');
    const t = analyzeEnforcementTopology({ flow: FLOW, boundaries: [safeBoundary()] });
    expect(explainEnforcementTopology(t)).toContain('topology[');
    const c = buildEnforcementCertification({ flow: FLOW, enforcement: envelopeWith(0).enforcement });
    expect(explainEnforcementCertification(c)).toContain('cert[');
  });
});

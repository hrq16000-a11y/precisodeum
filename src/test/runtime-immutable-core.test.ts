/**
 * Fase 1.8.8 — Runtime Immutable Core tests (READ-ONLY).
 * 40+ deterministic tests.
 */

import { describe, expect, it } from 'vitest';
import {
  IMMUTABLE_AUDIT_ACTIONS,
  adaptRuntimeLayersToBoundaries,
  aggregateImmutableSeals,
  aggregateImmutableState,
  aggregateImmutableViolations,
  analyzeImmutableContainment,
  analyzeImmutableTopology,
  assertAllImmutableIntegrity,
  assertImmutableCertificationIntegrity,
  assertImmutableCoverage,
  assertImmutableDeterminism,
  assertImmutableReadOnlyInvariant,
  assertImmutableSealIntegrity,
  assertImmutableTopologyIntegrity,
  assertNoCrossLayerEscape,
  assertNoRuntimeUnlock,
  buildBoundary,
  buildEnvelope,
  buildImmutableAuditPayload,
  buildImmutableCertification,
  buildImmutableRanking,
  buildImmutableSeal,
  calculateImmutableConfidence,
  classifyContainmentIntegrity,
  classifyImmutableIntegrity,
  classifyImmutableSafety,
  collectSealViolations,
  detectBoundaryOverride,
  detectContainmentFailure,
  detectCrossLayerEscape,
  detectDeterminismViolation,
  detectImmutableCertificationFailure,
  detectImplicitRuntimeMutation,
  detectInvariantBreak,
  detectPropagationUnlock,
  detectRecursiveTopologyUnlock,
  detectRuntimeRegression,
  detectRuntimeUnlock,
  detectSealCompromise,
  detectTopologyInstability,
  detectTopologyLeak,
  detectUnsafeInvariantMutation,
  explainImmutableCertification,
  explainImmutableContainment,
  explainImmutableSeal,
  explainImmutableTopology,
  explainImmutableViolation,
  isImmutableAuditPayloadPiiFree,
  rankImmutableCertification,
  rankImmutableTopologyRisk,
  summarizeImmutableHealth,
  validateImmutableInvariants,
} from '@/lib/runtimeImmutableCore';
import type { ImmutableBoundary, ImmutableSeal } from '@/lib/runtimeImmutableCore';

const FLOW = 'flow_a' as any;
const FLOW_B = 'flow_b' as any;

function safeBoundary(): ImmutableBoundary {
  return buildBoundary({ flow: FLOW, layer: 'enforcement' });
}

function sealWith(violations: number, compromised = false): ImmutableSeal {
  const vs = Array.from({ length: violations }, (_, i) => ({
    flow: FLOW,
    layer: 'enforcement' as const,
    type: 'runtime_mutation' as const,
    severity: (compromised ? 'CRITICAL' : 'HIGH') as 'CRITICAL' | 'HIGH',
    detail: `v${i}`,
  }));
  const boundaries = compromised
    ? [buildBoundary({ flow: FLOW, layer: 'enforcement', liveExecutionEnabled: true })]
    : [safeBoundary()];
  return buildImmutableSeal(FLOW, boundaries, vs);
}

describe('1.8.8 — immutable seal', () => {
  it('A. classify safe as IMMUTABLE', () => {
    expect(classifyImmutableIntegrity({ flow: FLOW, layer: 'enforcement' })).toBe('IMMUTABLE');
  });

  it('B. live execution = COMPROMISED', () => {
    expect(classifyImmutableIntegrity({ flow: FLOW, layer: 'enforcement', liveExecutionEnabled: true })).toBe('COMPROMISED');
  });

  it('C. retry = COMPROMISED', () => {
    expect(classifyImmutableIntegrity({ flow: FLOW, layer: 'enforcement', retryEnabled: true })).toBe('COMPROMISED');
  });

  it('D. recursive unlock = COMPROMISED', () => {
    expect(classifyImmutableIntegrity({ flow: FLOW, layer: 'enforcement', recursiveUnlock: true })).toBe('COMPROMISED');
  });

  it('E. wrong stage = RESTRICTED', () => {
    expect(classifyImmutableIntegrity({ flow: FLOW, layer: 'enforcement', currentStage: 'STAGE_1' })).toBe('RESTRICTED');
  });

  it('F. implicit mutation = GUARDED', () => {
    expect(classifyImmutableIntegrity({ flow: FLOW, layer: 'enforcement', implicitMutation: true })).toBe('GUARDED');
  });

  it('G. boundary holds read-only invariants', () => {
    const b = safeBoundary();
    expect(b.liveExecutionEnabled).toBe(false);
    expect(b.retryEnabled).toBe(false);
    expect(b.backgroundEnabled).toBe(false);
    expect(b.realUsersAllowed).toBe(false);
    expect(b.currentStage).toBe('STAGE_0_READ_ONLY');
  });

  it('H. detect seal compromise on live', () => {
    expect(detectSealCompromise({ flow: FLOW, layer: 'enforcement', liveExecutionEnabled: true })?.severity).toBe('CRITICAL');
    expect(detectSealCompromise({ flow: FLOW, layer: 'enforcement' })).toBeNull();
  });

  it('I. detect boundary override', () => {
    expect(detectBoundaryOverride({ flow: FLOW, layer: 'enforcement', boundaryOverride: true })?.type).toBe('boundary_override');
  });

  it('J. detect runtime unlock', () => {
    expect(detectRuntimeUnlock({ flow: FLOW, layer: 'enforcement', retryEnabled: true })?.severity).toBe('HIGH');
  });

  it('K. detect implicit runtime mutation', () => {
    expect(detectImplicitRuntimeMutation({ flow: FLOW, layer: 'enforcement', implicitMutation: true })?.severity).toBe('HIGH');
  });

  it('L. collectSealViolations aggregates recursive', () => {
    const vs = collectSealViolations({ flow: FLOW, layer: 'enforcement', recursiveUnlock: true, implicitMutation: true });
    expect(vs.length).toBeGreaterThanOrEqual(2);
  });

  it('M. buildImmutableSeal CRITICAL becomes COMPROMISED', () => {
    const s = sealWith(1, true);
    expect(s.classification).toBe('COMPROMISED');
    expect(s.compromised).toBe(true);
  });

  it('N. buildImmutableSeal no violations becomes IMMUTABLE', () => {
    const s = buildImmutableSeal(FLOW, [safeBoundary()], []);
    expect(s.classification).toBe('IMMUTABLE');
    expect(s.compromised).toBe(false);
  });
});

describe('1.8.8 — invariants', () => {
  it('O. validateImmutableInvariants all satisfied on safe', () => {
    const inv = validateImmutableInvariants({ flow: FLOW, layer: 'enforcement' });
    expect(inv.every(i => i.satisfied)).toBe(true);
  });

  it('P. detectInvariantBreak on live', () => {
    expect(detectInvariantBreak({ flow: FLOW, layer: 'enforcement', liveExecutionEnabled: true })?.severity).toBe('CRITICAL');
  });

  it('Q. detectDeterminismViolation diff', () => {
    expect(detectDeterminismViolation({ score: 1, classification: 'IMMUTABLE' }, { score: 0.5, classification: 'GUARDED' })).toBe(true);
    expect(detectDeterminismViolation({ score: 1, classification: 'IMMUTABLE' }, { score: 1, classification: 'IMMUTABLE' })).toBe(false);
  });

  it('R. detectRuntimeRegression increase', () => {
    expect(detectRuntimeRegression({ previousClassification: 'IMMUTABLE', currentClassification: 'COMPROMISED' })).toBe(true);
    expect(detectRuntimeRegression({ previousClassification: 'COMPROMISED', currentClassification: 'IMMUTABLE' })).toBe(false);
  });

  it('S. detectUnsafeInvariantMutation', () => {
    expect(detectUnsafeInvariantMutation({ flow: FLOW, layer: 'enforcement', backgroundEnabled: true })?.type).toBe('runtime_mutation');
  });
});

describe('1.8.8 — topology', () => {
  it('T. analyze safe topology', () => {
    const t = analyzeImmutableTopology({ flow: FLOW, boundaries: [safeBoundary()] });
    expect(t.violations.length).toBe(0);
  });

  it('U. detect topology instability on overlaps>2', () => {
    expect(detectTopologyInstability({ flow: FLOW, boundaries: [safeBoundary()], overlaps: 4 })?.severity).toBe('HIGH');
  });

  it('V. detect recursive topology unlock', () => {
    expect(detectRecursiveTopologyUnlock({ flow: FLOW, boundaries: [safeBoundary()], recursive: true })?.severity).toBe('CRITICAL');
  });

  it('W. detect topology leak', () => {
    expect(detectTopologyLeak({ flow: FLOW, boundaries: [safeBoundary()], leakDetected: true })?.severity).toBe('MEDIUM');
  });

  it('X. rank topology recursive=CRITICAL', () => {
    const t = analyzeImmutableTopology({ flow: FLOW, boundaries: [safeBoundary()], recursive: true });
    expect(rankImmutableTopologyRisk(t)).toBe('CRITICAL');
  });
});

describe('1.8.8 — containment', () => {
  it('Y. detect containment failure', () => {
    expect(detectContainmentFailure({ flow: FLOW, boundaries: [safeBoundary()], containmentFailure: true })?.type).toBe('drift_escape');
  });

  it('Z. detect cross-layer escape', () => {
    expect(detectCrossLayerEscape({ flow: FLOW, boundaries: [safeBoundary()], crossLayerEscape: true })?.severity).toBe('HIGH');
  });

  it('AA. detect propagation unlock', () => {
    expect(detectPropagationUnlock({ flow: FLOW, boundaries: [safeBoundary()], propagationUnlock: true })?.type).toBe('implicit_runtime_enablement');
  });

  it('AB. classifyContainmentIntegrity intact', () => {
    expect(classifyContainmentIntegrity({ flow: FLOW, boundaries: [safeBoundary()] })).toBe('intact');
    expect(classifyContainmentIntegrity({ flow: FLOW, boundaries: [safeBoundary()], containmentFailure: true })).toBe('broken');
  });

  it('AC. analyzeImmutableContainment intact has no violations', () => {
    const r = analyzeImmutableContainment({ flow: FLOW, boundaries: [safeBoundary()] });
    expect(r.violations.length).toBe(0);
    expect(r.integrity).toBe('intact');
  });
});

describe('1.8.8 — certification', () => {
  it('AD. classifyImmutableSafety FULL on safe seal', () => {
    expect(classifyImmutableSafety({ flow: FLOW, seal: sealWith(0) })).toBe('FULL');
  });

  it('AE. BLOCKED on live execution', () => {
    expect(classifyImmutableSafety({ flow: FLOW, seal: sealWith(0), liveExecutionEnabled: true })).toBe('BLOCKED');
  });

  it('AF. BLOCKED on pilot active', () => {
    expect(classifyImmutableSafety({ flow: FLOW, seal: sealWith(0), pilotActive: true })).toBe('BLOCKED');
  });

  it('AG. CONDITIONAL on stage mismatch', () => {
    expect(classifyImmutableSafety({ flow: FLOW, seal: sealWith(0), currentStage: 'STAGE_1' })).toBe('CONDITIONAL');
  });

  it('AH. confidence zero on compromise', () => {
    expect(calculateImmutableConfidence({ flow: FLOW, seal: sealWith(1, true) })).toBe(0);
  });

  it('AI. confidence drops on violations', () => {
    const c = calculateImmutableConfidence({ flow: FLOW, seal: sealWith(3) });
    expect(c).toBeLessThan(1);
  });

  it('AJ. detectImmutableCertificationFailure on retry', () => {
    expect(detectImmutableCertificationFailure({ flow: FLOW, seal: sealWith(0), retryEnabled: true })).toBe(true);
  });

  it('AK. buildImmutableCertification certified true on FULL', () => {
    const c = buildImmutableCertification({ flow: FLOW, seal: sealWith(0) });
    expect(c.certified).toBe(true);
    expect(c.level).toBe('FULL');
  });

  it('AL. rankImmutableCertification puts FULL first', () => {
    const full = buildImmutableCertification({ flow: FLOW, seal: sealWith(0) });
    const blocked = buildImmutableCertification({ flow: FLOW_B, seal: sealWith(0), liveExecutionEnabled: true });
    const ranked = rankImmutableCertification([blocked, full]);
    expect(ranked[0].level).toBe('FULL');
  });
});

describe('1.8.8 — aggregation', () => {
  it('AM. aggregateImmutableState counts', () => {
    const agg = aggregateImmutableState([buildEnvelope(sealWith(0)), buildEnvelope(sealWith(1, true))]);
    expect(agg.flows).toBe(2);
    expect(agg.compromised).toBe(1);
  });

  it('AN. aggregateImmutableViolations flattens', () => {
    expect(aggregateImmutableViolations([buildEnvelope(sealWith(2))]).length).toBe(2);
  });

  it('AO. aggregateImmutableSeals maps', () => {
    expect(aggregateImmutableSeals([buildEnvelope(sealWith(0))]).length).toBe(1);
  });

  it('AP. buildImmutableRanking puts IMMUTABLE first', () => {
    const ranked = buildImmutableRanking([buildEnvelope(sealWith(1, true)), buildEnvelope(sealWith(0))]);
    expect(ranked[0].seal.classification).toBe('IMMUTABLE');
  });

  it('AQ. summarizeImmutableHealth healthy=false on compromised', () => {
    expect(summarizeImmutableHealth([buildEnvelope(sealWith(1, true))]).healthy).toBe(false);
  });

  it('AR. envelope has read-only invariants', () => {
    const env = buildEnvelope(sealWith(0));
    expect(env.liveExecutionEnabled).toBe(false);
    expect(env.retryEnabled).toBe(false);
    expect(env.backgroundEnabled).toBe(false);
    expect(env.realUsersAllowed).toBe(false);
    expect(env.currentStage).toBe('STAGE_0_READ_ONLY');
  });
});

describe('1.8.8 — adapters & observability', () => {
  it('AS. adaptRuntimeLayersToBoundaries inert', () => {
    const bs = adaptRuntimeLayersToBoundaries({
      flow: FLOW, enforcement: {}, isolation: {}, integrity: {},
    });
    expect(bs.length).toBe(3);
    expect(bs.every(b => b.liveExecutionEnabled === false)).toBe(true);
  });

  it('AT. observability strips PII keys', () => {
    const p = buildImmutableAuditPayload('runtime_immutable_generated', FLOW, {
      email: 'a@b.com', safe: 'ok',
    } as any);
    expect('email' in p.metadata).toBe(false);
    expect(p.metadata.safe).toBe('ok');
  });

  it('AU. isImmutableAuditPayloadPiiFree detects url', () => {
    const p = { action: 'runtime_immutable_generated' as const, flow: FLOW, metadata: { foo: 'https://a.com' } };
    expect(isImmutableAuditPayloadPiiFree(p)).toBe(false);
  });

  it('AV. IMMUTABLE_AUDIT_ACTIONS exposes 7 actions', () => {
    expect(IMMUTABLE_AUDIT_ACTIONS.length).toBe(7);
  });
});

describe('1.8.8 — guards & integrity', () => {
  it('AW. assertImmutableCoverage fails on empty', () => {
    expect(assertImmutableCoverage([]).length).toBeGreaterThan(0);
  });

  it('AX. assertImmutableReadOnlyInvariant safe on read-only', () => {
    expect(assertImmutableReadOnlyInvariant(buildEnvelope(sealWith(0))).length).toBe(0);
  });

  it('AY. assertNoRuntimeUnlock triggers on unlock violations', () => {
    const seal = buildImmutableSeal(FLOW, [safeBoundary()], [
      { flow: FLOW, layer: 'enforcement', type: 'implicit_runtime_enablement', severity: 'HIGH', detail: 'x' },
    ]);
    expect(assertNoRuntimeUnlock(seal).length).toBe(1);
  });

  it('AZ. assertNoCrossLayerEscape triggers on escape', () => {
    const seal = buildImmutableSeal(FLOW, [safeBoundary()], [
      { flow: FLOW, layer: 'enforcement', type: 'cross_layer_side_effect', severity: 'HIGH', detail: 'x' },
    ]);
    expect(assertNoCrossLayerEscape(seal).length).toBe(1);
  });

  it('BA. assertImmutableDeterminism flags divergence', () => {
    const a = buildEnvelope(sealWith(0));
    const b = buildEnvelope(sealWith(1, true));
    expect(assertImmutableDeterminism(a, b).length).toBe(1);
  });

  it('BB. assertImmutableTopologyIntegrity recursive triggers', () => {
    const t = analyzeImmutableTopology({ flow: FLOW, boundaries: [safeBoundary()], recursive: true, overlaps: 5 });
    expect(assertImmutableTopologyIntegrity(t).length).toBeGreaterThanOrEqual(2);
  });

  it('BC. assertImmutableCertificationIntegrity catches mismatch', () => {
    expect(assertImmutableCertificationIntegrity({
      flow: FLOW, level: 'BLOCKED', confidence: 1, certified: true, reasons: [],
    }).length).toBe(1);
  });

  it('BD. assertImmutableSealIntegrity safe on consistent seal', () => {
    expect(assertImmutableSealIntegrity(sealWith(0)).length).toBe(0);
  });

  it('BE. assertAllImmutableIntegrity composes clean', () => {
    expect(assertAllImmutableIntegrity([buildEnvelope(sealWith(0))]).length).toBe(0);
  });
});

describe('1.8.8 — explainers', () => {
  it('BF. explainImmutableSeal string', () => {
    expect(explainImmutableSeal(sealWith(0))).toContain('seal[');
  });

  it('BG. explainImmutableViolation/Topology/Containment/Cert', () => {
    const s = sealWith(1);
    expect(explainImmutableViolation(s.violations[0])).toContain('violation[');
    expect(explainImmutableTopology(analyzeImmutableTopology({ flow: FLOW, boundaries: [safeBoundary()] }))).toContain('topology[');
    expect(explainImmutableContainment(analyzeImmutableContainment({ flow: FLOW, boundaries: [safeBoundary()] }))).toContain('containment[');
    expect(explainImmutableCertification(buildImmutableCertification({ flow: FLOW, seal: sealWith(0) }))).toContain('cert[');
  });
});

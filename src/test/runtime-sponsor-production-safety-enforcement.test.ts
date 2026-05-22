/**
 * Phase 1.9.48 — Sponsor Production Safety Enforcement Plane tests.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_SAFETY_INTERNALS,
  SAFETY_UPSTREAM_LAYERS,
  SAFETY_BLOCKING_VECTORS,
  SPONSOR_SAFETY_INVARIANTS,
  SPONSOR_BLOCKING_VECTORS,
  SPONSOR_ESCALATION_CONSTRAINTS,
  escalationFor,
  evaluateSafetyConstraints,
  enforceFailClosedPolicy,
  evaluateRuntimeSafety,
  assertActivationSafety,
  buildExecutionInterdictionMatrix,
  buildActivationVetoGraph,
  buildRuntimeKillSwitchGraph,
  buildSafetyProofs,
  runSafetyEnforcementRuntime,
  resolveSponsorProductionSafetyEnforcementPlane,
  assertSafetyEnforcementDeterminism,
} from '@/lib/runtimeSponsorProductionSafetyEnforcement';

describe('Phase 1.9.48 — Sponsor Production Safety Enforcement Plane', () => {
  it('internals are frozen, fail-closed, and consume layers 1.9.14 → 1.9.47', () => {
    expect(Object.isFrozen(SPONSOR_SAFETY_INTERNALS)).toBe(true);
    expect(SPONSOR_SAFETY_INTERNALS.enforcementMode).toBe('FAIL_CLOSED_DETERMINISTIC');
    expect(SPONSOR_SAFETY_INTERNALS.defaultDecision).toBe('BLOCK');
    expect(SAFETY_UPSTREAM_LAYERS.length).toBe(34);
    expect(SAFETY_BLOCKING_VECTORS).toContain('activation');
    expect(SAFETY_BLOCKING_VECTORS).toContain('rollout');
    expect(SPONSOR_SAFETY_INVARIANTS.length).toBe(10);
    expect(SPONSOR_BLOCKING_VECTORS.every((v) => v.defaultDecision === 'BLOCK' && !v.canBypass)).toBe(true);
    expect(SPONSOR_ESCALATION_CONSTRAINTS.every((c) => !c.autoUnlock)).toBe(true);
    expect(escalationFor('critical').action).toBe('BLOCK_AND_KILL_SWITCH');
  });

  it('zero-violation input still produces fail-closed BLOCK_DEFAULT decision', () => {
    const ev = evaluateSafetyConstraints({});
    expect(ev.violations.length).toBe(0);
    const d = enforceFailClosedPolicy(ev.violations);
    expect(d.allow).toBe(false);
    expect(d.action).toBe('BLOCK_DEFAULT');
    expect(d.reason).toBe('no_violations_but_default_block_when_unproven');
  });

  it('any violation forces fail-closed and reports highest severity', () => {
    const ev = evaluateSafetyConstraints({
      realNetworking: true,
      exposureExceeded: true,
    });
    expect(ev.violations.length).toBe(2);
    const d = enforceFailClosedPolicy(ev.violations);
    expect(d.allow).toBe(false);
    expect(d.highestSeverity).toBe('critical');
    expect(d.action).toBe('BLOCK_AND_KILL_SWITCH');
  });

  it('runtime safety evaluator is deterministic and bit-stable', () => {
    const r1 = evaluateRuntimeSafety({ rolloutInvalid: true });
    const r2 = evaluateRuntimeSafety({ rolloutInvalid: true });
    expect(r1.reportSignature).toBe(r2.reportSignature);
    expect(r1.decision.allow).toBe(false);
    expect(assertActivationSafety({ rolloutInvalid: true })).toBe(true);
    expect(assertActivationSafety({})).toBe(true);
  });

  it('interdiction matrix, veto graph and kill-switch graph are canonical', () => {
    const m1 = buildExecutionInterdictionMatrix();
    const m2 = buildExecutionInterdictionMatrix();
    expect(m1.matrixSignature).toBe(m2.matrixSignature);
    expect(m1.entries.every((e) => e.decision === 'BLOCK')).toBe(true);
    expect(m1.entries.length).toBe(SAFETY_BLOCKING_VECTORS.length);

    const v1 = buildActivationVetoGraph();
    const v2 = buildActivationVetoGraph();
    expect(v1.graphSignature).toBe(v2.graphSignature);

    const k1 = buildRuntimeKillSwitchGraph();
    const k2 = buildRuntimeKillSwitchGraph();
    expect(k1.graphSignature).toBe(k2.graphSignature);
    expect(k1.nodes.length).toBe(SAFETY_BLOCKING_VECTORS.length + 1);
  });

  it('safety proofs span all upstream layers × invariants', () => {
    const p = buildSafetyProofs();
    expect(p.proofs.length).toBe(SAFETY_UPSTREAM_LAYERS.length * SPONSOR_SAFETY_INVARIANTS.length);
    expect(buildSafetyProofs().proofsSignature).toBe(p.proofsSignature);
  });

  it('enforcement runtime is deterministic and frozen', () => {
    const a = runSafetyEnforcementRuntime({ realPersistence: true });
    const b = runSafetyEnforcementRuntime({ realPersistence: true });
    expect(a.runtimeSignature).toBe(b.runtimeSignature);
    expect(Object.isFrozen(a)).toBe(true);
    expect(a.report.decision.allow).toBe(false);
  });

  it('plane envelope is rollback-reproducible and never grants activation', () => {
    const p1 = resolveSponsorProductionSafetyEnforcementPlane();
    const p2 = resolveSponsorProductionSafetyEnforcementPlane();
    expect(p1.planeSignature).toBe(p2.planeSignature);
    expect(p1.envelope.envelopeSignature).toBe(p2.envelope.envelopeSignature);
    expect(p1.activationAllowed).toBe(false);
    expect(Object.isFrozen(p1)).toBe(true);
    expect(assertSafetyEnforcementDeterminism(p1)).toBe(true);

    // Same input → same envelope; different input → different envelope.
    const p3 = resolveSponsorProductionSafetyEnforcementPlane({ realBilling: true });
    expect(p3.activationAllowed).toBe(false);
    expect(p3.planeSignature).not.toBe(p1.planeSignature);
  });

  it('no side-effects: invoking plane does not mutate internals', () => {
    const before = JSON.stringify(SPONSOR_SAFETY_INTERNALS);
    resolveSponsorProductionSafetyEnforcementPlane({ realNetworking: true });
    runSafetyEnforcementRuntime({ rolloutInvalid: true });
    evaluateRuntimeSafety({ activationInvalid: true });
    const after = JSON.stringify(SPONSOR_SAFETY_INTERNALS);
    expect(before).toBe(after);
  });
});

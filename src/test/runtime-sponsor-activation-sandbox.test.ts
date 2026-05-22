/**
 * Phase 1.9.47 — Sponsor Runtime Activation Sandbox tests.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_SANDBOX_INTERNALS,
  SANDBOX_ROLLOUT_STAGES,
  SANDBOX_UPSTREAM_LAYERS,
  simulateConstraintEvaluation,
  simulateExposureEscalation,
  simulateFullRollout,
  simulateActivationFlow,
  buildSandboxExecutionGraph,
  buildSandboxDependencyTopology,
  buildSandboxProofs,
  resolveSponsorRuntimeActivationSandbox,
  checkStageExposure,
  assertNoRealSideEffects,
} from '@/lib/runtimeSponsorActivationSandbox';

describe('Phase 1.9.47 — Sponsor Runtime Activation Sandbox', () => {
  it('internals are frozen and forbid real side-effects', () => {
    expect(Object.isFrozen(SPONSOR_SANDBOX_INTERNALS)).toBe(true);
    expect(SPONSOR_SANDBOX_INTERNALS.sandboxMode).toBe('DETERMINISTIC_DRY_RUN_ONLY');
    expect(SPONSOR_SANDBOX_INTERNALS.realNetworkingAllowed).toBe(false);
    expect(SPONSOR_SANDBOX_INTERNALS.realPersistenceAllowed).toBe(false);
    expect(SPONSOR_SANDBOX_INTERNALS.realBillingAllowed).toBe(false);
    expect(SPONSOR_SANDBOX_INTERNALS.realSchedulingAllowed).toBe(false);
    expect(SPONSOR_SANDBOX_INTERNALS.realMonetizationAllowed).toBe(false);
    expect(assertNoRealSideEffects()).toBe(true);
    expect(SANDBOX_UPSTREAM_LAYERS.length).toBe(33);
    expect(SANDBOX_ROLLOUT_STAGES[0]).toBe('dark_launch');
    expect(SANDBOX_ROLLOUT_STAGES[SANDBOX_ROLLOUT_STAGES.length - 1]).toBe('general_availability');
  });

  it('checkStageExposure enforces exposure and concurrency caps', () => {
    expect(
      checkStageExposure({ stage: 'canary_1pct', requestedExposurePct: 1, requestedConcurrentActivations: 25 }),
    ).toEqual([]);
    const v = checkStageExposure({
      stage: 'canary_1pct',
      requestedExposurePct: 10,
      requestedConcurrentActivations: 9999,
    });
    expect(v.map((x) => x.guard).sort()).toEqual(['concurrency_cap', 'exposure_cap']);
  });

  it('simulateConstraintEvaluation is deterministic + bit-stable', () => {
    const a = simulateConstraintEvaluation({
      stage: 'canary_5pct',
      requestedExposurePct: 5,
      requestedConcurrentActivations: 100,
    });
    const b = simulateConstraintEvaluation({
      stage: 'canary_5pct',
      requestedExposurePct: 5,
      requestedConcurrentActivations: 100,
    });
    expect(a.admitted).toBe(true);
    expect(a.evaluationSignature).toBe(b.evaluationSignature);
  });

  it('exposure escalation covers all stages and is reproducible', () => {
    const e1 = simulateExposureEscalation();
    const e2 = simulateExposureEscalation();
    expect(e1.steps.length).toBe(SANDBOX_ROLLOUT_STAGES.length);
    expect(e1.simulationSignature).toBe(e2.simulationSignature);
    expect(e1.steps.every((s) => s.admitted)).toBe(true);
  });

  it('full rollout simulation is bit-stable across runs', () => {
    const r1 = simulateFullRollout();
    const r2 = simulateFullRollout();
    expect(r1.simulationSignature).toBe(r2.simulationSignature);
    expect(r1.stages.length).toBe(SANDBOX_ROLLOUT_STAGES.length);
    expect(r1.stages.every((s) => s.evaluation.admitted)).toBe(true);
  });

  it('activation flow is deterministic and frozen', () => {
    const f1 = simulateActivationFlow();
    const f2 = simulateActivationFlow();
    expect(f1.flowSignature).toBe(f2.flowSignature);
    expect(Object.isFrozen(f1)).toBe(true);
  });

  it('execution graph + dependency topology are canonical and stable', () => {
    const g1 = buildSandboxExecutionGraph();
    const g2 = buildSandboxExecutionGraph();
    expect(g1.graphSignature).toBe(g2.graphSignature);
    const ids = g1.nodes.map((n) => n.id);
    expect([...ids].sort()).toEqual(ids); // already sorted canonically

    const d1 = buildSandboxDependencyTopology();
    const d2 = buildSandboxDependencyTopology();
    expect(d1.graphSignature).toBe(d2.graphSignature);
    expect(d1.nodes.length).toBe(SANDBOX_UPSTREAM_LAYERS.length + 1);
  });

  it('sandbox proofs cover all upstream layers × invariants', () => {
    const p = buildSandboxProofs();
    expect(p.proofs.length).toBe(SANDBOX_UPSTREAM_LAYERS.length * 9);
    expect(buildSandboxProofs().proofsSignature).toBe(p.proofsSignature);
  });

  it('sandbox envelope is deterministic, frozen, and rollback-reproducible', () => {
    const a = resolveSponsorRuntimeActivationSandbox();
    const b = resolveSponsorRuntimeActivationSandbox();
    expect(a.sandboxSignature).toBe(b.sandboxSignature);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(a.envelope.locked).toBe(true);
    expect(Object.isFrozen(a.envelope)).toBe(true);
    expect(Object.isFrozen(a.envelope.payload)).toBe(true);
  });

  it('zero side-effects: invoking sandbox does not mutate global state', () => {
    const before = JSON.stringify(SPONSOR_SANDBOX_INTERNALS);
    resolveSponsorRuntimeActivationSandbox();
    simulateActivationFlow();
    simulateFullRollout();
    const after = JSON.stringify(SPONSOR_SANDBOX_INTERNALS);
    expect(before).toBe(after);
  });
});

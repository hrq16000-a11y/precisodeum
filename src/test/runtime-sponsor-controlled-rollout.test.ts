/**
 * Testes — Fase 1.9.49 Controlled Rollout Orchestrator.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_ROLLOUT_INTERNALS,
  orchestrateRolloutStages,
  coordinateExposureProgression,
  resolveRolloutDependencies,
  assertNoDependencyDrift,
  simulateRolloutConvergence,
  assertConvergenceStable,
  buildRolloutDependencyGraph,
  buildSequenceTopology,
  buildConvergenceGraph,
  buildExposurePlan,
  buildRolloutSnapshot,
  buildRolloutLineage,
  buildRolloutProofMatrix,
  buildRolloutEnvelope,
  certifyControlledRollout,
  certifyResume,
  validateResume,
  ROLLOUT_STAGE_ORDER,
} from '@/lib/runtimeSponsorControlledRollout';

describe('Fase 1.9.49 · Controlled Rollout Orchestrator', () => {
  it('internals são read-only e fail-closed', () => {
    expect(SPONSOR_ROLLOUT_INTERNALS.realRolloutAllowed).toBe(false);
    expect(SPONSOR_ROLLOUT_INTERNALS.realBillingAllowed).toBe(false);
    expect(SPONSOR_ROLLOUT_INTERNALS.failClosed).toBe(true);
    expect(Object.isFrozen(SPONSOR_ROLLOUT_INTERNALS)).toBe(true);
  });

  it('stages são determinísticos e nunca autorizam exposição', () => {
    const a = orchestrateRolloutStages();
    const b = orchestrateRolloutStages();
    expect(a).toEqual(b);
    expect(a.every((s) => s.allowed === false)).toBe(true);
  });

  it('exposição é monotonicamente não-decrescente', () => {
    const plan = coordinateExposureProgression();
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i].exposurePct).toBeGreaterThanOrEqual(plan[i - 1].exposurePct);
    }
  });

  it('dependency resolver é livre de drift', () => {
    const deps = resolveRolloutDependencies();
    expect(() => assertNoDependencyDrift(deps)).not.toThrow();
  });

  it('convergência é estável entre execuções', () => {
    const a = simulateRolloutConvergence();
    const b = simulateRolloutConvergence();
    expect(() => assertConvergenceStable(a, b)).not.toThrow();
  });

  it('grafos e topologias são canônicos', () => {
    expect(buildRolloutDependencyGraph()).toEqual(buildRolloutDependencyGraph());
    expect(buildSequenceTopology()).toEqual(buildSequenceTopology());
    expect(buildConvergenceGraph()).toEqual(buildConvergenceGraph());
  });

  it('exposure plan jamais permite real exposure', () => {
    const plan = buildExposurePlan();
    expect(plan.realExposureAllowed).toBe(false);
    expect(plan.maxExposurePct).toBe(100);
  });

  it('snapshot é bit-stable', () => {
    expect(buildRolloutSnapshot().signature).toEqual(buildRolloutSnapshot().signature);
  });

  it('lineage cumulativa cobre 1.9.14 → 1.9.48', () => {
    const lin = buildRolloutLineage();
    expect(lin.length).toBe(SPONSOR_ROLLOUT_INTERNALS.consumes.length);
  });

  it('proof matrix cobre todas as camadas com todos os invariantes', () => {
    const proofs = buildRolloutProofMatrix();
    expect(proofs.length).toBe(SPONSOR_ROLLOUT_INTERNALS.consumes.length * 10);
    expect(proofs.every((p) => p.holds === true)).toBe(true);
  });

  it('envelope é bit-stable entre execuções (sem side-effects)', () => {
    const e1 = buildRolloutEnvelope();
    const e2 = buildRolloutEnvelope();
    expect(e1.signature).toBe(e2.signature);
    expect(Object.isFrozen(e1)).toBe(true);
  });

  it('certificação nunca autoriza rollout real', () => {
    const cert = certifyControlledRollout();
    expect(cert.rolloutAuthorized).toBe(false);
    expect(cert.mode).toBe('DETERMINISTIC_SIMULATION_ONLY');
  });

  it('resume validator é determinístico', () => {
    for (const stage of ROLLOUT_STAGE_ORDER) {
      const r1 = certifyResume(stage);
      const r2 = validateResume(stage);
      expect(r1).toEqual(r2);
      expect(r1.canResume).toBe(true);
    }
  });
});

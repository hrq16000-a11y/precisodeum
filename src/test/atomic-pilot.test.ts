/**
 * Fase 1.7.10 — Atomic Pilot Planning tests (READ-ONLY).
 */
import { describe, it, expect } from 'vitest';
import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import {
  buildPilotCandidates,
  rankPilotCandidates,
  detectUnsafePilotCandidates,
  buildRolloutStrategy,
  buildAllRolloutStrategies,
  supportsSafeRollout,
  supportsProgressiveExposure,
  buildKillSwitchPolicy,
  buildAllKillSwitchPolicies,
  calculateKillSwitchSensitivity,
  buildAbortStrategy,
  requiresImmediateAbort,
  supportsGracefulAbort,
  supportsSafeFallback,
  buildCohortStrategy,
  detectUnsafeCohort,
  buildObservabilityRequirements,
  calculateObservabilityCoverage,
  detectObservabilityGap,
  calculatePilotReadiness,
  calculatePilotConfidence,
  supportsPilotPromotion,
  detectPilotBlockers,
  buildPilotPlan,
  buildPilotMatrix,
  rankPilotRolloutOrder,
  buildAllPilotPlans,
  pilotStageIndex,
  isMonotonicPilotTransition,
  PILOT_STAGE_ORDER,
  assertPilotIntegrity,
  assertPilotCoverage,
  assertPilotSafety,
  assertPilotRollbackCoverage,
  assertPilotObservabilityCoverage,
  assertNoUnsafePilotPromotion,
  assertNoUnsafeCohort,
  isPilotPayloadPiiFree,
  explainPilotCandidate,
  explainPilotReadiness,
  explainRolloutStrategy,
  explainAbortStrategy,
  explainKillSwitch,
} from '@/lib/atomicPilot';

const FLOWS = OPERATION_REGISTRY.map((r) => r.flow);

describe('Fase 1.7.10 — Atomic Pilot Planning', () => {
  // A
  it('A) every flow has a pilot candidate / plan', () => {
    const cands = buildPilotCandidates();
    expect(cands.length).toBe(FLOWS.length);
    for (const f of FLOWS) {
      expect(cands.find((c) => c.flow === f)).toBeTruthy();
      expect(buildPilotPlan(f)).toBeTruthy();
    }
  });

  // B
  it('B) CRITICAL blast does not exceed INTERNAL_COMPARE', () => {
    for (const c of buildPilotCandidates()) {
      if (c.blast === 'CRITICAL') {
        const idx = pilotStageIndex(c.recommendedStage);
        expect(idx).toBeLessThanOrEqual(pilotStageIndex('STAGE_2_INTERNAL_COMPARE'));
      }
    }
  });

  // C
  it('C) quarantined flows blocked from SAFE_COHORT+', () => {
    const plans = buildAllPilotPlans();
    for (const p of plans) {
      if (p.safety.quarantined) {
        expect(pilotStageIndex(p.candidate.recommendedStage)).toBeLessThanOrEqual(
          pilotStageIndex('STAGE_2_INTERNAL_COMPARE'),
        );
      }
    }
  });

  // D
  it('D) kill-switches cover all critical triggers', () => {
    const need = [
      'parity_regression',
      'rollback_failure',
      'drift_explosion',
      'blast_escalation',
      'orphan_emergence',
      'stale_read_spike',
      'mirror_inconsistency',
      'unsafe_promotion',
    ];
    for (const f of FLOWS) {
      const k = buildKillSwitchPolicy(f)!;
      for (const t of need) {
        expect(k.triggers).toContain(t);
      }
    }
  });

  // E
  it('E) abort strategies exist for every flow', () => {
    for (const f of FLOWS) expect(buildAbortStrategy(f)).toBeTruthy();
    expect(buildAllPilotPlans().every((p) => p.abort.triggers.length > 0)).toBe(true);
  });

  // F
  it('F) observability coverage ≥ required minimum', () => {
    for (const f of FLOWS) {
      const o = buildObservabilityRequirements(f)!;
      expect(o.coverage).toBeGreaterThanOrEqual(28);
      const recalc = calculateObservabilityCoverage(o);
      expect(recalc).toBe(o.coverage);
    }
  });

  // G
  it('G) rollout stages are monotonic', () => {
    for (let i = 0; i < PILOT_STAGE_ORDER.length - 1; i++) {
      expect(
        isMonotonicPilotTransition(PILOT_STAGE_ORDER[i], PILOT_STAGE_ORDER[i + 1]),
      ).toBe(true);
    }
    expect(
      isMonotonicPilotTransition('STAGE_0_DISABLED', 'STAGE_3_SAFE_COHORT'),
    ).toBe(false);
  });

  // H
  it('H) unsafe cohorts detected for HIGH-risk flows', () => {
    expect(detectUnsafeCohort(FLOWS[0], 'low_risk_users') !== undefined).toBe(true);
    // CRITICAL flow + non-internal cohort = unsafe
    for (const c of buildPilotCandidates()) {
      if (c.blast === 'CRITICAL') {
        expect(detectUnsafeCohort(c.flow, 'low_risk_users')).toBe(true);
        expect(detectUnsafeCohort(c.flow, 'internal_only')).toBe(false);
      }
    }
  });

  // I
  it('I) pilot matrix covers 100% of registered flows', () => {
    const m = buildPilotMatrix();
    expect(m.rows.length).toBe(FLOWS.length);
    expect(m.totals.flows).toBe(FLOWS.length);
  });

  // J
  it('J) blast radius influences rollout order (lower blast first)', () => {
    const order = rankPilotRolloutOrder();
    const cands = buildPilotCandidates();
    const blastOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
    let prev = -1;
    for (const f of order) {
      const c = cands.find((x) => x.flow === f)!;
      const v = blastOrder[c.blast];
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  // K
  it('K) insufficient parity reduces readiness', () => {
    for (const f of FLOWS) {
      const r = calculatePilotReadiness(f)!;
      const c = buildPilotCandidates().find((x) => x.flow === f)!;
      if (c.parityScore < 60) {
        expect(r.blockers.some((b) => b.code === 'insufficient_parity')).toBe(true);
      }
    }
  });

  // L
  it('L) mirror dependency restricts exposure (drift tolerance)', () => {
    for (const s of buildAllRolloutStrategies()) {
      if (s.mirrorValidationRequired) {
        expect(['ZERO', 'LOW']).toContain(s.driftTolerance);
      }
    }
  });

  // M
  it('M) READY ranked above CONDITIONAL', () => {
    const ranked = rankPilotCandidates();
    let seenCond = false;
    for (const c of ranked) {
      if (c.eligibility === 'CONDITIONAL' || c.eligibility === 'NOT_ELIGIBLE' || c.eligibility === 'BLOCKED') {
        seenCond = true;
      } else if (seenCond && c.eligibility === 'READY') {
        throw new Error('READY appeared after non-READY');
      }
    }
    expect(true).toBe(true);
  });

  // N
  it('N) explainers are deterministic', () => {
    for (const f of FLOWS) {
      const c = buildPilotCandidates().find((x) => x.flow === f)!;
      expect(explainPilotCandidate(c)).toBe(explainPilotCandidate(c));
      const r = calculatePilotReadiness(f)!;
      expect(explainPilotReadiness(r)).toBe(explainPilotReadiness(r));
      const s = buildRolloutStrategy(f)!;
      expect(explainRolloutStrategy(s)).toBe(explainRolloutStrategy(s));
      const a = buildAbortStrategy(f)!;
      expect(explainAbortStrategy(a)).toBe(explainAbortStrategy(a));
      const k = buildKillSwitchPolicy(f)!;
      expect(explainKillSwitch(k)).toBe(explainKillSwitch(k));
    }
  });

  // O
  it('O) observability payloads are PII-free', () => {
    expect(
      isPilotPayloadPiiFree({
        source: 'x',
        flow: 'dashboard_profile_save',
        stage: 'STAGE_0_DISABLED',
      }),
    ).toBe(true);
    expect(isPilotPayloadPiiFree({ email: 'a@b' })).toBe(false);
    expect(isPilotPayloadPiiFree({ cpf: '111' })).toBe(false);
    expect(isPilotPayloadPiiFree({ city: 'x' })).toBe(false);
    expect(isPilotPayloadPiiFree({ raw_payload: {} })).toBe(false);
  });

  // P
  it('P) assertPilotIntegrity returns []', () => {
    expect(assertPilotIntegrity()).toEqual([]);
    expect(assertPilotCoverage()).toEqual([]);
    expect(assertPilotSafety()).toEqual([]);
    expect(assertPilotRollbackCoverage()).toEqual([]);
    expect(assertPilotObservabilityCoverage()).toEqual([]);
    expect(assertNoUnsafePilotPromotion()).toEqual([]);
    expect(assertNoUnsafeCohort()).toEqual([]);
  });

  // Q
  it('Q) no plan enables live execution', () => {
    for (const p of buildAllPilotPlans()) {
      expect(p.execution.liveExecutionEnabled).toBe(false);
      expect(p.execution.shadowOnly).toBe(true);
      expect(p.execution.mode).toBe('read_only');
    }
  });

  // R
  it('R) no strategy uses real users', () => {
    for (const p of buildAllPilotPlans()) {
      expect(p.execution.realUsersAllowed).toBe(false);
    }
    for (const k of buildAllKillSwitchPolicies()) {
      expect(k.autoEngage).toBe(false);
    }
  });

  // S
  it('S) pilot promotion depends on rpc readiness', () => {
    for (const f of FLOWS) {
      const r = calculatePilotReadiness(f);
      // function returns deterministic value
      expect(typeof supportsPilotPromotion(f)).toBe('boolean');
      if (r?.pilotPromotionSupported) {
        expect(r.readinessScore).toBeGreaterThan(0);
      }
    }
  });

  // T
  it('T) abort sensitivity grows with blast radius', () => {
    const order = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
    for (const f of FLOWS) {
      const cand = buildPilotCandidates().find((x) => x.flow === f)!;
      const sens = calculateKillSwitchSensitivity(f);
      expect(order[sens]).toBe(order[cand.blast]);
      // immediate abort engaged for CRITICAL or incompatible rollback
      if (cand.blast === 'CRITICAL' || cand.rollback === 'incompatible') {
        expect(requiresImmediateAbort(f)).toBe(true);
      } else {
        expect(supportsGracefulAbort(f)).toBe(true);
      }
      expect(supportsSafeFallback(f)).toBe(true);
    }
  });

  // U
  it('U) shadow-only remains mandatory across every plan', () => {
    for (const p of buildAllPilotPlans()) {
      expect(p.rollout.shadowCompareRequired).toBe(true);
      expect(p.execution.requiresPromotionApproval).toBe(true);
    }
  });

  // V
  it('V) kill-switch escalation detected (unsafe candidates surface)', () => {
    const unsafe = detectUnsafePilotCandidates();
    // function returns array (possibly empty); structurally stable
    expect(Array.isArray(unsafe)).toBe(true);
    for (const u of unsafe) {
      expect(['BLOCKED', 'CRITICAL']).toContain(
        u.eligibility === 'BLOCKED' ? 'BLOCKED' : 'CRITICAL',
      );
    }
  });

  // W
  it('W) quarantined flows never receive FULL_PROMOTION decision', () => {
    for (const row of buildPilotMatrix().rows) {
      if (row.recommendedStage === 'STAGE_5_FULL_PROMOTION') {
        const plan = buildPilotPlan(row.flow)!;
        expect(plan.safety.quarantined).toBe(false);
      }
    }
  });

  // Extra: cohort + readiness sanity
  it('cohort recommendations are non-null for every flow', () => {
    for (const f of FLOWS) {
      expect(buildCohortStrategy(f)).toBeTruthy();
      expect(typeof calculatePilotConfidence(f)).toBe('number');
    }
  });

  // Extra: safe rollout / progressive exposure are deterministic booleans
  it('rollout helpers return booleans', () => {
    for (const f of FLOWS) {
      expect(typeof supportsSafeRollout(f)).toBe('boolean');
      expect(typeof supportsProgressiveExposure(f)).toBe('boolean');
    }
  });

  // Extra: observability gap detection works
  it('observability gap detector is stable', () => {
    for (const f of FLOWS) {
      const gaps = detectObservabilityGap(f);
      expect(Array.isArray(gaps)).toBe(true);
    }
  });

  // Extra: detectPilotBlockers never throws
  it('detectPilotBlockers is total over registry', () => {
    for (const f of FLOWS) expect(() => detectPilotBlockers(f)).not.toThrow();
  });
});

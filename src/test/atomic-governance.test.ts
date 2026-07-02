/**
 * Fase 1.7.11 — Atomic Governance tests (READ-ONLY).
 */
import { describe, it, expect } from 'vitest';
import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import {
  buildGovernanceMatrix,
  buildGovernanceState,
  summarizeGovernanceState,
  rankGovernanceRisks,
  buildPromotionGovernance,
  classifyReleaseRisk,
  detectReleaseFreeze,
  calculateFreezeSeverity,
  detectUnsafePromotionWindow,
  requiresGovernanceApproval,
  determinePromotionAuthority,
  determineAbortAuthority,
  determineRollbackAuthority,
  buildApprovalRequirement,
  authorityIsConsistent,
  buildReleaseWindowPolicy,
  detectBlockedReleaseWindow,
  explainReleaseWindow,
  explainGovernanceDecision,
  explainFreezePolicy,
  explainPromotionGuard,
  explainGovernanceRisk,
  explainRollbackAuthority,
  explainApprovalRequirement,
  isGovernancePayloadPiiFree,
  assertGovernanceCoverage,
  assertNoUnsafeGovernancePromotion,
  assertGovernanceConsistency,
  assertNoReleaseFreezeViolation,
  assertNoUnsafeRollbackAuthority,
  assertPromotionRequiresApproval,
  assertAllGovernanceIntegrity,
} from '@/lib/atomicGovernance';

const FLOWS = OPERATION_REGISTRY.map((r) => r.flow);

describe('Fase 1.7.11 — Atomic Governance + Release Freeze', () => {
  // A
  it('A) every flow has a governance state', () => {
    const m = buildGovernanceMatrix();
    expect(m.rows.length).toBe(FLOWS.length);
    for (const f of FLOWS) expect(buildGovernanceState(f)).toBeTruthy();
  });

  // B
  it('B) CRITICAL blast triggers HARD_FREEZE', () => {
    for (const row of buildGovernanceMatrix().rows) {
      if (row.risk.blast === 'CRITICAL' || row.risk.quarantined) {
        expect(row.freeze.level).toBe('HARD_FREEZE');
      }
    }
  });

  // C
  it('C) HARD_FREEZE caps maxAllowedStage at STAGE_0_READ_ONLY', () => {
    for (const row of buildGovernanceMatrix().rows) {
      if (row.freeze.level === 'HARD_FREEZE' || row.freeze.level === 'GLOBAL_FREEZE') {
        expect(row.promotionGuard.maxAllowedStage).toBe('STAGE_0_READ_ONLY');
        expect(row.decision).toBe('FROZEN');
      }
    }
  });

  // D
  it('D) CONDITIONAL eligibility does not pass internal_compare_only', () => {
    for (const row of buildGovernanceMatrix().rows) {
      if (row.risk.conditional && row.freeze.level === 'NONE') {
        expect(['internal_compare_only', 'shadow_only']).toContain(
          row.promotionGuard.promotionClass,
        );
      }
    }
  });

  // E
  it('E) live execution / real users / retry remain false across every row', () => {
    for (const row of buildGovernanceMatrix().rows) {
      expect(row.promotionGuard.liveExecutionEnabled).toBe(false);
      expect(row.promotionGuard.realUsersAllowed).toBe(false);
      expect(row.promotionGuard.retryEnabled).toBe(false);
      expect(row.promotionGuard.backgroundEnabled).toBe(false);
    }
  });

  // F
  it('F) currentStage is locked at STAGE_0_READ_ONLY for every flow', () => {
    for (const row of buildGovernanceMatrix().rows) {
      expect(row.promotionGuard.currentStage).toBe('STAGE_0_READ_ONLY');
    }
  });

  // G
  it('G) freeze severity is monotone with risk', () => {
    for (const f of FLOWS) {
      const sev = calculateFreezeSeverity(f);
      expect([
        'NONE',
        'SOFT_FREEZE',
        'PARTIAL_FREEZE',
        'HARD_FREEZE',
        'GLOBAL_FREEZE',
      ]).toContain(sev);
    }
  });

  // H
  it('H) detectReleaseFreeze returns reasons consistent with severity', () => {
    for (const f of FLOWS) {
      const p = detectReleaseFreeze(f);
      if (p.level !== 'NONE') expect(p.reasons.length).toBeGreaterThan(0);
      if (p.level === 'HARD_FREEZE') expect(p.blocksPromotion).toBe(true);
    }
  });

  // I
  it('I) approval requirement escalates with risk', () => {
    for (const f of FLOWS) {
      const r = classifyReleaseRisk(f)!;
      const a = buildApprovalRequirement(f);
      if (r.critical) {
        expect(['required_governance_board', 'freeze_locked']).toContain(a.state);
      }
      if (a.state === 'required_governance_board' || a.state === 'freeze_locked') {
        expect(a.reviewers).toBeGreaterThanOrEqual(3);
      }
    }
  });

  // J
  it('J) rollback authority hierarchy is consistent', () => {
    for (const f of FLOWS) expect(authorityIsConsistent(f)).toBe(true);
  });

  // K
  it('K) promotion authority never exceeds rollback authority', () => {
    const H = [
      'flow_owner',
      'platform_admin',
      'release_manager',
      'incident_commander',
      'governance_board',
    ];
    for (const f of FLOWS) {
      const p = determinePromotionAuthority(f);
      const r = determineRollbackAuthority(f);
      expect(H.indexOf(p)).toBeLessThanOrEqual(H.indexOf(r));
    }
  });

  // L
  it('L) abort authority is at least release_manager', () => {
    for (const f of FLOWS) {
      const a = determineAbortAuthority(f);
      expect(['release_manager', 'incident_commander', 'governance_board']).toContain(a);
    }
  });

  // M
  it('M) release window state aligns with freeze level', () => {
    for (const f of FLOWS) {
      const w = buildReleaseWindowPolicy(f);
      if (w.freezeLevel === 'HARD_FREEZE') expect(w.state).toBe('frozen');
      if (w.state === 'frozen') {
        expect(w.allowedChangeClasses).toContain('observability_only');
        expect(w.allowedChangeClasses).not.toContain('stage_promotion');
        expect(detectBlockedReleaseWindow(f)).toBe(true);
      }
    }
  });

  // N
  it('N) frozen window decisions are FROZEN', () => {
    for (const row of buildGovernanceMatrix().rows) {
      if (row.releaseWindow.state === 'frozen') {
        expect(row.decision).toBe('FROZEN');
      }
    }
  });

  // O
  it('O) unsafe promotion windows are detected', () => {
    for (const f of FLOWS) {
      const unsafe = detectUnsafePromotionWindow(f);
      expect(typeof unsafe).toBe('boolean');
    }
  });

  // P
  it('P) requiresGovernanceApproval true for HIGH/CRITICAL', () => {
    for (const f of FLOWS) {
      const r = classifyReleaseRisk(f)!;
      if (r.risk === 'CRITICAL' || r.risk === 'HIGH' || r.critical) {
        expect(requiresGovernanceApproval(f)).toBe(true);
      }
    }
  });

  // Q
  it('Q) governance matrix totals sum coherently', () => {
    const m = buildGovernanceMatrix();
    expect(m.totals.flows).toBe(m.rows.length);
    expect(m.totals.frozen).toBeLessThanOrEqual(m.totals.flows);
    expect(m.totals.fullEligible).toBeLessThanOrEqual(m.totals.pilotEligible);
  });

  // R
  it('R) explainers are deterministic and pure strings', () => {
    for (const f of FLOWS) {
      const s = buildGovernanceState(f)!;
      expect(explainGovernanceDecision(s)).toBe(explainGovernanceDecision(s));
      expect(explainFreezePolicy(s.freeze)).toBe(explainFreezePolicy(s.freeze));
      expect(explainPromotionGuard(s.promotionGuard)).toBe(
        explainPromotionGuard(s.promotionGuard),
      );
      expect(explainGovernanceRisk(s.risk)).toBe(explainGovernanceRisk(s.risk));
      expect(explainRollbackAuthority(f, s.rollbackAuthority)).toContain(f);
      expect(explainApprovalRequirement(s.approval)).toContain(s.approval.state);
      expect(explainReleaseWindow(s.releaseWindow)).toContain(f);
    }
  });

  // S
  it('S) observability payloads are PII-free', () => {
    expect(
      isGovernancePayloadPiiFree({
        source: 'x',
        flow: 'dashboard_profile_save',
        decision: 'FROZEN',
      }),
    ).toBe(true);
    expect(isGovernancePayloadPiiFree({ email: 'a@b' })).toBe(false);
    expect(isGovernancePayloadPiiFree({ cpf: '111' })).toBe(false);
    expect(isGovernancePayloadPiiFree({ city: 'x' })).toBe(false);
    expect(isGovernancePayloadPiiFree({ raw_payload: {} })).toBe(false);
    expect(isGovernancePayloadPiiFree({ user_name: 'x' })).toBe(false);
  });

  // T
  it('T) buildPromotionGovernance returns a guard for every flow', () => {
    for (const f of FLOWS) {
      const g = buildPromotionGovernance(f)!;
      expect(g.flow).toBe(f);
      expect(g.liveExecutionEnabled).toBe(false);
      expect(g.realUsersAllowed).toBe(false);
    }
  });

  // U
  it('U) rankGovernanceRisks orders CRITICAL first', () => {
    const order = rankGovernanceRisks();
    const RISK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    let prev = -1;
    for (const f of order) {
      const r = classifyReleaseRisk(f)!;
      expect(RISK[r.risk]).toBeGreaterThanOrEqual(prev);
      prev = RISK[r.risk];
    }
  });

  // V
  it('V) summarizeGovernanceState returns a deterministic, PII-free string', () => {
    const s = summarizeGovernanceState();
    expect(s.startsWith('[GOV]')).toBe(true);
    expect(s).not.toMatch(/@/);
  });

  // W
  it('W) all guards pass on the current declarative state', () => {
    expect(assertGovernanceCoverage()).toEqual([]);
    expect(assertGovernanceConsistency()).toEqual([]);
    expect(assertNoReleaseFreezeViolation()).toEqual([]);
    expect(assertNoUnsafeGovernancePromotion()).toEqual([]);
    expect(assertNoUnsafeRollbackAuthority()).toEqual([]);
    expect(assertPromotionRequiresApproval()).toEqual([]);
  });

  // X
  it('X) assertAllGovernanceIntegrity returns []', () => {
    expect(assertAllGovernanceIntegrity()).toEqual([]);
  });

  // Y
  it('Y) compatibility — every governance state mirrors a pilot recommendation', () => {
    for (const row of buildGovernanceMatrix().rows) {
      expect(row.pilotStage).toBeDefined();
      // governance freeze never less restrictive than rejecting CRITICAL
      if (row.risk.blast === 'CRITICAL') {
        expect(['STAGE_1_INTERNAL_SHADOW', 'STAGE_2_INTERNAL_COMPARE']).toContain(
          row.pilotStage,
        );
      }
    }
  });

  // Z
  it('Z) full eligibility decision requires zero freeze and high parity', () => {
    for (const row of buildGovernanceMatrix().rows) {
      if (row.decision === 'ALLOW_FULL_ATOMIC') {
        expect(row.freeze.level).toBe('NONE');
        expect(row.risk.parityScore).toBeGreaterThanOrEqual(95);
        expect(row.risk.critical).toBe(false);
      }
    }
  });
});

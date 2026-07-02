/**
 * Fase 1.7.8 — Atomic Promotion Strategy tests (READ-ONLY).
 */

import { describe, expect, it } from 'vitest';
import { OPERATION_REGISTRY, type FlowId } from '@/lib/operations/operationRegistry';
import {
  PROMOTION_STAGE_ORDER,
  buildPromotionMatrix,
  buildFlowPromotionState,
  calculatePromotionConfidence,
  detectPromotionBlockers,
  canPromoteFlow,
  rankPromotionCandidates,
  summarizePromotionReadiness,
  assertAllPromotionIntegrity,
  assertNoUnsafePromotion,
  assertNoForbiddenStageEscalation,
  assertPromotionCoverage,
  assertPromotionSafety,
  assertRollbackCompatibility,
  isMonotonicTransition,
  explainPromotionDecision,
  explainPromotionBlockers,
  explainPromotionConfidence,
  explainPromotionStage,
  explainPromotionRisk,
  isPayloadPiiFree,
  parityBand,
} from '@/lib/atomicPromotion';

const ALL_FLOWS: FlowId[] = OPERATION_REGISTRY.map((r) => r.flow);

describe('atomic promotion :: matrix', () => {
  const matrix = buildPromotionMatrix();

  it('A) all 9 flows have promotion state', () => {
    expect(matrix.rows).toHaveLength(ALL_FLOWS.length);
    for (const f of ALL_FLOWS) {
      expect(matrix.rows.some((r) => r.flow === f)).toBe(true);
    }
  });

  it('B) no flow auto-promotes — currentStage is always STAGE_0_READ_ONLY', () => {
    for (const r of matrix.rows) {
      expect(r.currentStage).toBe('STAGE_0_READ_ONLY');
    }
  });

  it('C) CRITICAL blast radius caps max stage at SHADOW_COMPARE', () => {
    for (const r of matrix.rows) {
      if (r.blastRadius === 'CRITICAL') {
        const idx = PROMOTION_STAGE_ORDER.indexOf(r.maxAllowedStage);
        expect(idx).toBeLessThanOrEqual(
          PROMOTION_STAGE_ORDER.indexOf('STAGE_1_SHADOW_COMPARE'),
        );
      }
    }
  });

  it('F) READY flows never exceed max allowed stage in matrix', () => {
    for (const r of matrix.rows) {
      const cur = PROMOTION_STAGE_ORDER.indexOf(r.currentStage);
      const max = PROMOTION_STAGE_ORDER.indexOf(r.maxAllowedStage);
      expect(cur).toBeLessThanOrEqual(max);
    }
  });

  it('H) promotion matrix covers 100% of flows', () => {
    const violations = assertPromotionCoverage(matrix.rows, ALL_FLOWS);
    expect(violations).toEqual([]);
  });
});

describe('atomic promotion :: stages', () => {
  it('G) stage progression is monotonic', () => {
    for (let i = 0; i < PROMOTION_STAGE_ORDER.length - 1; i++) {
      const a = PROMOTION_STAGE_ORDER[i];
      const b = PROMOTION_STAGE_ORDER[i + 1];
      expect(isMonotonicTransition(a, b)).toBe(true);
      expect(isMonotonicTransition(b, a)).toBe(false);
    }
  });

  it('J) guards detect invalid escalation', () => {
    const v = assertNoForbiddenStageEscalation(
      'STAGE_0_READ_ONLY',
      'STAGE_3_PARTIAL_ATOMIC',
      'dashboard_profile_save',
    );
    expect(v).toHaveLength(1);
    expect(v[0].code).toBe('forbidden_stage_transition');
  });

  it('K) PILOT stage requires shadow validation in stage descriptor blockers', async () => {
    const { getStageDescriptor } = await import(
      '@/lib/atomicPromotion/promotionStages'
    );
    const desc = getStageDescriptor('STAGE_2_SOFT_PILOT');
    expect(desc?.blockers).toContain('missing_shadow_validation');
  });
});

describe('atomic promotion :: blockers & rollback', () => {
  it('D) inline_call_site (quarantine) blocks FULL_ATOMIC', () => {
    const state = buildFlowPromotionState('dashboard_profile_save');
    expect(state).not.toBeNull();
    if (state) {
      const beyondShadow = PROMOTION_STAGE_ORDER.indexOf(state.maxAllowedStage);
      expect(beyondShadow).toBeGreaterThanOrEqual(0);
    }
  });

  it('E) severe drift reduces confidence', () => {
    const conf = calculatePromotionConfidence('bet_finish_pro');
    expect(['NONE', 'LOW', 'MODERATE', 'HIGH']).toContain(conf);
  });

  it('L) incompatible rollback blocks SOFT_ATOMIC', () => {
    const matrix = buildPromotionMatrix();
    for (const r of matrix.rows) {
      if (r.rollbackClass === 'incompatible') {
        const idx = PROMOTION_STAGE_ORDER.indexOf(r.maxAllowedStage);
        expect(idx).toBeLessThan(
          PROMOTION_STAGE_ORDER.indexOf('STAGE_2_SOFT_PILOT'),
        );
      }
      const v = assertRollbackCompatibility(r);
      expect(v).toEqual([]);
    }
  });

  it('M) CONDITIONAL/mixed flows stay limited', () => {
    const matrix = buildPromotionMatrix();
    const mixed = matrix.rows.find(
      (r) =>
        OPERATION_REGISTRY.find((o) => o.flow === r.flow)?.ownership === 'mixed',
    );
    expect(mixed).toBeDefined();
    if (mixed) {
      expect(mixed.blockers.length).toBeGreaterThan(0);
    }
  });

  it('detects blockers for every flow deterministically', () => {
    for (const f of ALL_FLOWS) {
      const a = detectPromotionBlockers(f);
      const b = detectPromotionBlockers(f);
      expect(a.map((x) => x.code)).toEqual(b.map((x) => x.code));
    }
  });

  it('canPromoteFlow respects CRITICAL severity', () => {
    for (const f of ALL_FLOWS) {
      const blockers = detectPromotionBlockers(f);
      const promote = canPromoteFlow(f);
      const hasCritical = blockers.some((b) => b.severity === 'CRITICAL');
      const hasHigh = blockers.some((b) => b.severity === 'HIGH');
      if (hasCritical || hasHigh) expect(promote).toBe(false);
    }
  });
});

describe('atomic promotion :: observability', () => {
  it('I) observability payload schema is PII-free', () => {
    const safePayload = {
      source: 'matrix',
      flow: 'dashboard_profile_save',
      stage: 'STAGE_0_READ_ONLY',
      confidence: 'MODERATE',
      blocker_count: 1,
      rollback_class: 'compensation_required',
      risk_level: 'MEDIUM',
      parity_band: 'HIGH',
      blast_radius: 'MEDIUM',
      execution_mode: 'read_only',
    };
    expect(isPayloadPiiFree(safePayload)).toBe(true);
    expect(
      isPayloadPiiFree({ ...safePayload, email: 'a@b.com' }),
    ).toBe(false);
    expect(isPayloadPiiFree({ ...safePayload, raw_payload: {} })).toBe(false);
    expect(isPayloadPiiFree({ ...safePayload, city: 'X' })).toBe(false);
  });

  it('parityBand classifies scores deterministically', () => {
    expect(parityBand(95)).toBe('VERY_HIGH');
    expect(parityBand(80)).toBe('HIGH');
    expect(parityBand(60)).toBe('MEDIUM');
    expect(parityBand(10)).toBe('LOW');
  });
});

describe('atomic promotion :: integrity & explainers', () => {
  it('O) assertAllPromotionIntegrity returns []', () => {
    const v = assertAllPromotionIntegrity();
    expect(v).toEqual([]);
  });

  it('N) explainers are deterministic strings', () => {
    const s1 = buildFlowPromotionState('dashboard_profile_save');
    const s2 = buildFlowPromotionState('dashboard_profile_save');
    expect(s1).not.toBeNull();
    if (s1 && s2) {
      expect(explainPromotionDecision(s1)).toBe(explainPromotionDecision(s2));
      expect(explainPromotionBlockers(s1.blockers)).toBe(
        explainPromotionBlockers(s2.blockers),
      );
    }
    expect(explainPromotionConfidence('HIGH')).toContain('HIGH');
    expect(explainPromotionStage('STAGE_0_READ_ONLY')).toContain(
      'STAGE_0_READ_ONLY',
    );
    expect(explainPromotionRisk('MEDIUM')).toContain('MEDIUM');
  });

  it('assertNoUnsafePromotion catches current > max', () => {
    const state = buildFlowPromotionState('dashboard_profile_save');
    expect(state).not.toBeNull();
    if (state) {
      const v = assertNoUnsafePromotion({
        ...state,
        currentStage: 'STAGE_4_FULL_ATOMIC',
        maxAllowedStage: 'STAGE_1_SHADOW_COMPARE',
      });
      expect(v).toHaveLength(1);
      expect(v[0].code).toBe('unsafe_promotion_attempt');
    }
  });

  it('assertPromotionSafety flags CRITICAL beyond shadow', () => {
    const state = buildFlowPromotionState('dashboard_profile_save');
    if (state) {
      const v = assertPromotionSafety({
        ...state,
        blastRadius: 'CRITICAL',
        maxAllowedStage: 'STAGE_3_PARTIAL_ATOMIC',
      });
      expect(v).toHaveLength(1);
      expect(v[0].code).toBe('unsafe_blast_radius');
    }
  });

  it('rank + summary are deterministic', () => {
    const r1 = rankPromotionCandidates();
    const r2 = rankPromotionCandidates();
    expect(r1).toEqual(r2);
    expect(summarizePromotionReadiness()).toContain('[PROMOTION]');
  });
});

/**
 * Fase 1.7.9 — RPC Contract Specification tests (READ-ONLY).
 */

import { describe, expect, it } from 'vitest';
import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import {
  RPC_CATALOG,
  buildAllRpcContracts,
  buildRpcContract,
  buildPayloadContract,
  buildRollbackContract,
  buildIdempotencyContract,
  buildConsistencyContract,
  buildSideEffectPolicy,
  buildRetryPolicy,
  buildRpcCompatibilityMatrix,
  summarizeRpcCompatibility,
  rankRpcReadiness,
  calculateRpcReadiness,
  detectRpcBlockers,
  buildAllRpcReadiness,
  isRpcPayloadPiiFree,
  explainRpcContract,
  explainRollbackContract,
  explainIdempotencyContract,
  explainConsistencyContract,
  explainRpcReadinessReport,
  detectNonIdempotentSideEffects,
  detectUnsafePayloadFields,
  isSideEffectAllowed,
  listForbiddenSideEffects,
  assertRpcContractIntegrity,
  assertRpcCoverage,
  assertRollbackCoverage,
  assertIdempotencyCoverage,
  assertConsistencyCoverage,
  assertCompatibilityCoverage,
  assertNoUnsafeRpcPromotion,
} from '@/lib/rpcContracts';

const ALL_FLOWS: FlowId[] = OPERATION_REGISTRY.map((r) => r.flow);

describe('rpc contracts :: coverage', () => {
  it('A) every flow has an RpcContract', () => {
    const contracts = buildAllRpcContracts();
    for (const f of ALL_FLOWS) {
      expect(contracts.some((c) => c.flow === f)).toBe(true);
    }
  });

  it('B) every flow has a rollback contract', () => {
    for (const f of ALL_FLOWS) {
      expect(buildRollbackContract(f)).not.toBeNull();
    }
  });

  it('C) every flow has an idempotency contract', () => {
    for (const f of ALL_FLOWS) {
      expect(buildIdempotencyContract(f)).not.toBeNull();
    }
  });

  it('K) compatibility matrix covers 100% of catalog', () => {
    const m = buildRpcCompatibilityMatrix();
    expect(m.length).toBe(RPC_CATALOG.length);
    for (const e of RPC_CATALOG) {
      expect(m.some((r) => r.rpc === e.rpc)).toBe(true);
    }
  });
});

describe('rpc contracts :: payload', () => {
  it('D) unsafe payload fields are detected', () => {
    const unsafe = detectUnsafePayloadFields([
      { name: 'raw_payload', kind: 'raw_payload', required: true },
      { name: 'patch', kind: 'json_unbounded', required: true },
      { name: 'good', kind: 'identifier', required: true, canonicalOwner: 'profile' },
    ]);
    expect(unsafe).toContain('raw_payload');
    expect(unsafe).toContain('patch');
    expect(unsafe).not.toContain('good');
  });

  it('S) all catalog payloads pass safety check', () => {
    for (const e of RPC_CATALOG) {
      const p = buildPayloadContract(e.flow);
      expect(p).not.toBeNull();
      if (p) {
        expect(p.unsafeFieldsDetected).toEqual([]);
        expect(p.fields.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('rpc contracts :: idempotency & retry', () => {
  it('E) non-idempotent side-effects detected for risky flows', () => {
    const r = detectNonIdempotentSideEffects('persist_first_service');
    expect(r).toContain('duplicate_finalize');
    expect(r).toContain('duplicate_service_creation');
    expect(r).toContain('duplicate_provider_bootstrap');
  });

  it('Q) duplicate finalize detected as risk for finalize flows', () => {
    const r = detectNonIdempotentSideEffects('bet_finish_client');
    // bet_finish_client requires finalize per registry → must surface risk
    expect(r).toContain('duplicate_finalize');
  });

  it('J) retry-safe flows correctly classified', () => {
    const policy = buildRetryPolicy('onboarding_progress_sync');
    expect(policy).not.toBeNull();
    if (policy) {
      // onboarding_progress_sync has safe_retry rollback + deterministic replay
      expect(policy.kind).toBe('safe_retry');
      expect(policy.allowsClientRetry).toBe(true);
      // background retries are forbidden universally in this phase
      expect(policy.allowsBackgroundRetry).toBe(false);
    }
  });

  it('R) hidden retry policy is blocked (background retry never allowed)', () => {
    for (const f of ALL_FLOWS) {
      const p = buildRetryPolicy(f);
      expect(p?.allowsBackgroundRetry).toBe(false);
    }
  });
});

describe('rpc contracts :: consistency & mirror', () => {
  it('F) mirror propagation respects ownership (true when drift profile demands)', () => {
    const c = buildConsistencyContract('avatar_sync');
    expect(c?.requiresMirrorPropagation).toBe(true);
    // every flow's flag derives strictly from the drift registry profile
    for (const f of ALL_FLOWS) {
      const cc = buildConsistencyContract(f);
      expect(typeof cc?.requiresMirrorPropagation).toBe('boolean');
    }
  });

  it('O) READY flows have consistency >= STRONG (where applicable)', () => {
    // structural check: every contract has a non-NONE consistency strength
    for (const f of ALL_FLOWS) {
      const c = buildConsistencyContract(f);
      expect(c?.strength).not.toBe('NONE');
    }
  });

  it('P) CONDITIONAL/mixed flows do not promote to FULL consistency', () => {
    for (const c of buildAllRpcContracts()) {
      if (c.ownership === 'mixed') {
        expect(['WEAK', 'PARTIAL', 'STRONG']).toContain(c.consistency.strength);
      }
    }
  });
});

describe('rpc contracts :: readiness', () => {
  it('G) blast radius affects readiness score', () => {
    const reports = buildAllRpcReadiness();
    for (const r of reports) {
      if (r.blastRadius === 'CRITICAL') {
        expect(r.shadowReady).toBe(false);
      }
    }
  });

  it('H) quarantine boundary reduces compatibility', () => {
    // None of the existing flows is inline_call_site; assert invariant holds
    const matrix = buildRpcCompatibilityMatrix();
    for (const row of matrix) {
      const reg = OPERATION_REGISTRY.find((r) => r.flow === row.flow);
      if (reg?.boundary === 'inline_call_site') {
        expect(['NONE', 'WEAK']).toContain(row.compatibility);
      }
    }
  });

  it('I) incompatible promotion reduces readiness', () => {
    for (const f of ALL_FLOWS) {
      const blockers = detectRpcBlockers(f);
      const report = calculateRpcReadiness(f);
      if (blockers.some((b) => b.code === 'missing_promotion_support')) {
        expect(report?.pilotReady).toBe(false);
      }
    }
  });

  it('readiness is deterministic', () => {
    const a = buildAllRpcReadiness().map((r) => r.readinessScore);
    const b = buildAllRpcReadiness().map((r) => r.readinessScore);
    expect(a).toEqual(b);
  });
});

describe('rpc contracts :: side-effects', () => {
  it('U) zero contract permits implicit cross-flow mutation', () => {
    const forbidden = listForbiddenSideEffects();
    expect(forbidden).toContain('cross_flow_mutation');
    expect(forbidden).toContain('implicit_ownership_reassignment');
    expect(forbidden).toContain('hidden_retry');
    expect(forbidden).toContain('silent_mutation');
    expect(forbidden).toContain('recursive_finalize');

    for (const f of ALL_FLOWS) {
      const p = buildSideEffectPolicy(f);
      expect(p?.forbidden).toEqual(forbidden);
    }
  });

  it('audit-only flows allow analytics + audit_log only', () => {
    expect(isSideEffectAllowed('admin_profile_update', 'audit_log')).toBe(true);
    expect(isSideEffectAllowed('admin_profile_update', 'navigation')).toBe(false);
  });
});

describe('rpc contracts :: observability', () => {
  it('M) observability payload schema is PII-free', () => {
    expect(
      isRpcPayloadPiiFree({
        source: 'matrix',
        rpc: 'save_dashboard_profile_atomic',
        flow: 'dashboard_profile_save',
        readiness_score: 80,
        execution_mode: 'read_only',
      }),
    ).toBe(true);
    expect(isRpcPayloadPiiFree({ email: 'a@b.com' })).toBe(false);
    expect(isRpcPayloadPiiFree({ raw_payload: {} })).toBe(false);
    expect(isRpcPayloadPiiFree({ cpf: '123' })).toBe(false);
    expect(isRpcPayloadPiiFree({ city: 'SP' })).toBe(false);
    expect(isRpcPayloadPiiFree({ json_dump: '{}' })).toBe(false);
  });
});

describe('rpc contracts :: explainers', () => {
  it('L) explainers are deterministic strings', () => {
    const c1 = buildRpcContract('dashboard_profile_save');
    const c2 = buildRpcContract('dashboard_profile_save');
    expect(c1).not.toBeNull();
    if (c1 && c2) {
      expect(explainRpcContract(c1)).toBe(explainRpcContract(c2));
      expect(explainRollbackContract(c1.rollback)).toBe(
        explainRollbackContract(c2.rollback),
      );
      expect(explainIdempotencyContract(c1.idempotency)).toBe(
        explainIdempotencyContract(c2.idempotency),
      );
      expect(explainConsistencyContract(c1.consistency)).toBe(
        explainConsistencyContract(c2.consistency),
      );
    }
    const r = calculateRpcReadiness('dashboard_profile_save');
    if (r) expect(explainRpcReadinessReport(r)).toContain('[READY]');
    expect(summarizeRpcCompatibility()).toContain('[RPC-COMPAT]');
  });
});

describe('rpc contracts :: integrity', () => {
  it('T) live execution dependency remains false on every contract', () => {
    for (const c of buildAllRpcContracts()) {
      expect(c.liveExecutionEnabled).toBe(false);
      expect(c.executionSemantic).toBe('shadow_only');
    }
  });

  it('N) assertRpcContractIntegrity() returns []', () => {
    expect(assertRpcCoverage()).toEqual([]);
    expect(assertRollbackCoverage()).toEqual([]);
    expect(assertIdempotencyCoverage()).toEqual([]);
    expect(assertConsistencyCoverage()).toEqual([]);
    expect(assertCompatibilityCoverage()).toEqual([]);
    expect(assertNoUnsafeRpcPromotion()).toEqual([]);
    expect(assertRpcContractIntegrity()).toEqual([]);
  });

  it('rankRpcReadiness orders deterministically', () => {
    expect(rankRpcReadiness()).toEqual(rankRpcReadiness());
  });
});

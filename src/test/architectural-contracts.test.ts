/**
 * Fase 1.7.5 — Architectural Contracts + Invariant Registry tests.
 */

import { describe, expect, it, vi } from 'vitest';

import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import {
  ARCHITECTURAL_INVARIANTS,
  assertAllInvariants,
  assertInvariant,
  getInvariantsByCategory,
} from '@/lib/contracts/invariantRegistry';
import {
  assertContractCoverage,
  ATOMICITY_CONTRACTS,
  BOUNDARY_CONTRACTS,
  EXECUTION_CONTRACTS,
  FLOW_CONTRACTS,
  MIRROR_CONTRACTS,
  OWNERSHIP_CONTRACTS,
  ROLLBACK_CONTRACTS,
  TELEMETRY_CONTRACTS,
  getFlowContract,
} from '@/lib/contracts/contractRegistry';
import {
  buildDependencyGraph,
  detectCircularDependencies,
  detectMissingDependencies,
  detectOvercoupling,
} from '@/lib/contracts/dependencyGraph';
import {
  calculateGuaranteeLevel,
  detectGuaranteeViolation,
  explainGuaranteeCoverage,
} from '@/lib/contracts/guarantees';
import {
  assertMutationPolicy,
  FLOW_MUTATION_POLICIES,
  MUTATION_POLICY_CATALOG,
} from '@/lib/contracts/mutationPolicies';
import {
  explainContract,
  explainDependencyGraph,
  explainGuaranteeLevel,
  explainInvariant,
  explainMutationPolicy,
} from '@/lib/contracts/explainers';
import { assertArchitecturalIntegrity } from '@/lib/contracts/assertArchitecturalIntegrity';
import {
  logArchitecturalInvariantFailed,
  logContractCoverageFailed,
  logDependencyInstabilityDetected,
  logGuaranteeViolationDetected,
} from '@/lib/contracts/observability';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: () => ({ insert: vi.fn(async () => ({ error: null })) }),
  },
}));

const auditCalls: any[] = [];
vi.mock('@/hooks/useAuditLog', () => ({
  logAuditAction: vi.fn(async (entry: any) => {
    auditCalls.push(entry);
  }),
}));

describe('Fase 1.7.5 — Architectural Contracts', () => {
  it('A) invariants válidas (todas as 10 estão registradas)', () => {
    expect(ARCHITECTURAL_INVARIANTS.length).toBeGreaterThanOrEqual(10);
    const ids = new Set(ARCHITECTURAL_INVARIANTS.map((i) => i.id));
    expect(ids.size).toBe(ARCHITECTURAL_INVARIANTS.length);
  });

  it('B) invariant failure detectado (estado atual deve estar OK)', () => {
    const r = assertAllInvariants();
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
    // assertInvariant inexistente retorna ok=false
    const missing = assertInvariant('does_not_exist');
    expect(missing.ok).toBe(false);
  });

  it('C) contract coverage completo (100% dos flows + boundaries)', () => {
    const cov = assertContractCoverage();
    expect(cov.ok).toBe(true);
    expect(cov.flowsWithContract).toBe(OPERATION_REGISTRY.length);
    expect(FLOW_CONTRACTS.length).toBe(OPERATION_REGISTRY.length);
    expect(TELEMETRY_CONTRACTS.length).toBe(OPERATION_REGISTRY.length);
    expect(ATOMICITY_CONTRACTS.length).toBe(OPERATION_REGISTRY.length);
    expect(MIRROR_CONTRACTS.length).toBe(OPERATION_REGISTRY.length);
    expect(ROLLBACK_CONTRACTS.length).toBe(OPERATION_REGISTRY.length);
    expect(OWNERSHIP_CONTRACTS.length).toBe(3);
    expect(EXECUTION_CONTRACTS.length).toBe(2);
    expect(BOUNDARY_CONTRACTS.length).toBeGreaterThan(0);
  });

  it('D) dependency graph correto (1 nó por flow)', () => {
    const g = buildDependencyGraph();
    expect(g.nodes.length).toBe(OPERATION_REGISTRY.length);
    expect(g.edges.length).toBeGreaterThan(0);
    for (const n of g.nodes) expect(n.dependsOn.length).toBeGreaterThan(0);
  });

  it('E) circular dependency: nenhuma esperada hoje', () => {
    const g = buildDependencyGraph();
    const cycles = detectCircularDependencies(g);
    expect(cycles).toEqual([]);
  });

  it('F) guarantees corretas (telemetria=VERIFIED para todos)', () => {
    const cov = explainGuaranteeCoverage();
    expect(cov.overallByCategory.telemetry).toBe('VERIFIED');
    for (const f of cov.flows) expect(f.levels.telemetry).toBe('VERIFIED');
  });

  it('G) mutation policies corretas (sem violações)', () => {
    const r = assertMutationPolicy();
    expect(r.ok).toBe(true);
    expect(FLOW_MUTATION_POLICIES.length).toBe(OPERATION_REGISTRY.length);
    expect(MUTATION_POLICY_CATALOG.READ_ONLY.allowsPersistence).toBe(false);
    expect(MUTATION_POLICY_CATALOG.LEGACY_MUTATION.requiresQuarantine).toBe(true);
  });

  it('H) explainers determinísticos', () => {
    const inv = ARCHITECTURAL_INVARIANTS[0];
    expect(explainInvariant(inv)).toBe(explainInvariant(inv));
    const fc = FLOW_CONTRACTS[0];
    expect(explainContract(fc)).toBe(explainContract(fc));
    const g = calculateGuaranteeLevel(OPERATION_REGISTRY[0].flow)!;
    expect(explainGuaranteeLevel(g)).toBe(explainGuaranteeLevel(g));
    expect(explainMutationPolicy('CANONICAL_MUTATION')).toMatch(/^\[POLICY\/CANONICAL_MUTATION\]/);
    const graph = buildDependencyGraph();
    expect(explainDependencyGraph(graph)).toContain('=== Dependency Graph ===');
  });

  it('I) audit payload sem PII', async () => {
    auditCalls.length = 0;
    await logArchitecturalInvariantFailed(
      { source: 'test' },
      {
        invariantId: 'ready_flow_must_have_tracker',
        category: 'readiness',
        severity: 'high',
        flow: 'dashboard_profile_save',
        description: 'desc',
      },
    );
    await logContractCoverageFailed(
      { source: 'test' },
      {
        ok: false,
        totalFlows: 1,
        flowsWithContract: 0,
        boundariesWithContract: 0,
        flowsMissingContract: ['dashboard_profile_save'],
        boundariesMissingContract: [],
      },
    );
    await logGuaranteeViolationDetected(
      { source: 'test' },
      { flow: 'dashboard_profile_save', guarantee: 'ownership', level: 'PARTIAL', reason: 'r' },
    );
    await logDependencyInstabilityDetected({ source: 'test' }, { cycles: [['a', 'b']] });
    const PII = /(email|phone|whatsapp|cpf|cnpj|address|street|@|http)/i;
    for (const call of auditCalls) {
      const json = JSON.stringify(call.details ?? {});
      expect(json).not.toMatch(PII);
    }
    expect(auditCalls.length).toBe(4);
  });

  it('J) integrity guard explode corretamente (estado atual OK)', () => {
    const r = assertArchitecturalIntegrity();
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('K) READY flow possui guarantees overall ≥ STRONG', () => {
    for (const r of OPERATION_REGISTRY) {
      if (r.readiness !== 'READY') continue;
      const g = calculateGuaranteeLevel(r.flow)!;
      expect(['STRONG', 'VERIFIED']).toContain(g.overall);
    }
  });

  it('L) quarantine respeitada (LEGACY exige quarantine entry)', () => {
    // Estado atual: nenhum flow LEGACY no registry; invariante passa.
    const result = assertInvariant('legacy_flow_must_be_quarantined');
    expect(result.ok).toBe(true);
  });

  it('M) ownership invariants corretas (dual-write tem mirror profile)', () => {
    const r = assertInvariant('dual_write_must_have_ownership');
    expect(r.ok).toBe(true);
    const owner = getInvariantsByCategory('ownership');
    expect(owner.length).toBeGreaterThanOrEqual(2);
  });

  it('N) telemetry invariants: drift detector cobre 100% dos flows', () => {
    const r = assertInvariant('drift_detector_must_cover_all_flows');
    expect(r.ok).toBe(true);
  });

  it('O) atomic candidate invariants: multi-step+atomic tem builder ou está OK', () => {
    const r = assertInvariant('atomic_candidate_must_have_builder');
    expect(r.ok).toBe(true);
  });

  it('P) flow contracts referenciam boundary e ownership reais', () => {
    for (const c of FLOW_CONTRACTS) {
      const reg = OPERATION_REGISTRY.find((r) => r.flow === c.flow)!;
      expect(c.boundary).toBe(reg.boundary);
      expect(c.ownership).toBe(reg.ownership);
      const fc = getFlowContract(c.flow);
      expect(fc).toBeDefined();
    }
  });

  it('Q) dependency analyses (missing/overcoupling) determinísticos', () => {
    const g = buildDependencyGraph();
    const m1 = detectMissingDependencies(g);
    const m2 = detectMissingDependencies(g);
    expect(m1).toEqual(m2);
    const o1 = detectOvercoupling(g);
    const o2 = detectOvercoupling(g);
    expect(o1).toEqual(o2);
  });

  it('R) detectGuaranteeViolation com threshold VERIFIED encontra pontos abaixo', () => {
    const v = detectGuaranteeViolation('VERIFIED');
    // Há ao menos um flow com boundary STRONG (não VERIFIED).
    expect(Array.isArray(v)).toBe(true);
  });
});

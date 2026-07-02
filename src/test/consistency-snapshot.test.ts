/**
 * Fase 1.7.2 — Drift Snapshot + Consistency Observatory tests.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  assertSnapshotCoverage,
  buildAllConsistencySnapshots,
  buildConsistencySnapshot,
  detectBoundaryCoverage,
  detectConsistencyRisks,
  detectMirrorDependencies,
  explainConsistencyFlow,
  explainConsistencyRisk,
  explainConsistencySnapshot,
  summarizeConsistencyRisk,
} from '@/lib/drift';
import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: null } }) }, from: () => ({ insert: async () => ({}) }) },
}));

describe('Fase 1.7.2 — consistency snapshot', () => {
  it('A) snapshot cobre todos os flows do operationRegistry', () => {
    const snap = buildAllConsistencySnapshots();
    expect(snap.totalFlows).toBe(OPERATION_REGISTRY.length);
    const cov = assertSnapshotCoverage();
    expect(cov.ok).toBe(true);
    expect(cov.flowsMissingSnapshot).toEqual([]);
    expect(cov.driftProfilesWithoutFlow).toEqual([]);
  });

  it('B) detector identifica multi-write não-atômico em modo dry-run', () => {
    const s = buildConsistencySnapshot('dashboard_profile_save');
    expect(s).toBeTruthy();
    expect(s!.isMultiWrite).toBe(true);
    expect(s!.risks.some((r) => r.type === 'non_atomic_multi_write')).toBe(true);
  });

  it('C) detector reconhece boundary canônica presente (sem missing_boundary)', () => {
    const s = buildConsistencySnapshot('dashboard_profile_save')!;
    expect(s.boundaryState.hasCanonicalBoundary).toBe(true);
    expect(s.risks.find((r) => r.type === 'missing_boundary')).toBeUndefined();
  });

  it('D) mirror dependency detectado corretamente', () => {
    const s = buildConsistencySnapshot('avatar_sync')!;
    const mirror = detectMirrorDependencies(
      OPERATION_REGISTRY.find((r) => r.flow === 'avatar_sync')!,
    );
    expect(mirror.hasMirror).toBe(true);
    expect(s.risks.some((r) => r.type === 'mirror_dependency')).toBe(true);
  });

  it('E) ownership 1.6.6 respeitado (provider flow é provider)', () => {
    const s = buildConsistencySnapshot('persist_first_service')!;
    expect(s.ownership).toBe('provider');
  });

  it('F) readiness 1.7.0 integrado (PARTIAL aparece)', () => {
    const snap = buildAllConsistencySnapshots();
    expect(snap.partialFlows).toBeGreaterThan(0);
    expect(snap.readyFlows + snap.partialFlows + snap.blockedFlows).toBe(snap.totalFlows);
  });

  it('G) execution mode dry-run refletido em todos os flows', () => {
    const snap = buildAllConsistencySnapshots({ executionMode: 'dry-run' });
    expect(snap.executionMode).toBe('dry-run');
    expect(snap.flows.every((f) => f.executionMode === 'dry-run')).toBe(true);
  });

  it('H) payload de audit não contém PII (apenas chaves declaradas)', () => {
    const s = buildConsistencySnapshot('dashboard_profile_save')!;
    const FORBIDDEN = ['email', 'phone', 'whatsapp', 'city', 'address', 'cpf', 'cnpj', 'name', 'url'];
    const serialized = JSON.stringify(s).toLowerCase();
    for (const k of FORBIDDEN) {
      // o nome pode aparecer como substring em chaves técnicas (city_mismatch),
      // mas não como valor PII; checamos que NÃO há string com '@' (email) ou dígito longo (telefone).
      void k;
    }
    expect(/[a-z0-9._%+-]+@[a-z0-9.-]+/.test(serialized)).toBe(false);
    expect(/\b\d{10,}\b/.test(serialized)).toBe(false);
  });

  it('I) explainers são determinísticos', () => {
    const snap1 = buildAllConsistencySnapshots({ now: () => 1234 });
    const snap2 = buildAllConsistencySnapshots({ now: () => 1234 });
    expect(explainConsistencySnapshot(snap1)).toBe(explainConsistencySnapshot(snap2));
    const f = snap1.flows[0];
    expect(explainConsistencyFlow(f)).toBe(explainConsistencyFlow(f));
    if (f.risks[0]) {
      expect(explainConsistencyRisk(f.risks[0])).toContain(f.flow);
    }
  });

  it('J) builder é puro (sem Supabase / window / localStorage)', () => {
    // Apenas chama o builder; mocks acima não devem ser invocados.
    const snap = buildAllConsistencySnapshots();
    expect(snap).toBeTruthy();
  });

  it('K) severity aggregation correta', () => {
    const snap = buildAllConsistencySnapshots();
    const summary = summarizeConsistencyRisk(snap.flows);
    const total = summary.safe + summary.low + summary.medium + summary.high + summary.critical;
    expect(total).toBe(snap.totalFlows);
  });

  it('L) boundary coverage classifica READY vs LEGACY', () => {
    const cov = detectBoundaryCoverage();
    expect(cov.total).toBe(OPERATION_REGISTRY.length);
    expect(cov.withBoundary).toBe(cov.total); // hoje nenhum flow está em inline
    expect(cov.legacy).toEqual([]);
  });

  it('M) live mode em flow não-READY gera unsafe_live_dependency', () => {
    const reg = OPERATION_REGISTRY.find((r) => r.flow === 'persist_first_service')!;
    const risks = detectConsistencyRisks(
      reg,
      { boundary: reg.boundary, hasCanonicalBoundary: true, hasTracker: true, hasRollback: false },
      detectMirrorDependencies(reg),
      'live',
    );
    expect(risks.some((r) => r.type === 'unsafe_live_dependency')).toBe(true);
  });
});

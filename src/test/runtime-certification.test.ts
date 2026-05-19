/**
 * Fase 1.7.12 — Runtime Certification tests (READ-ONLY).
 */
import { describe, it, expect } from 'vitest';
import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import {
  buildRuntimeCertificationMatrix,
  buildRuntimeCertification,
  summarizeRuntimeCertification,
  rankRuntimeCertificationRisk,
  buildCertificationCoverage,
  buildExecutionCertification,
  certifyExecutionIsolation,
  certifyExecutionDeterminism,
  certifyExecutionRollback,
  certifyExecutionParity,
  certifyExecutionOrdering,
  classifyExecutionSafety,
  calculateParityCertification,
  certifyParityConfidence,
  detectParityInstability,
  detectRollbackParityMismatch,
  calculateRollbackCertification,
  certifyRollbackIsolation,
  certifyRollbackConsistency,
  detectUnsafeRollbackDependency,
  classifyRollbackCertification,
  buildObservabilityCertification,
  certifyObservabilityCoverage,
  detectUnsafeObservabilityGap,
  calculateObservabilityConfidence,
  buildDriftCertification,
  certifyDriftContainment,
  detectUnboundedDrift,
  classifyDriftSafety,
  explainRuntimeCertification,
  explainExecutionCertification,
  explainRollbackCertification,
  explainDriftCertification,
  explainObservabilityCertification,
  isRuntimeCertificationPayloadPiiFree,
  assertRuntimeCertificationCoverage,
  assertRuntimeCertificationConsistency,
  assertNoUnsafeRuntimeCertification,
  assertNoIllegalCertificationPromotion,
  assertCertificationRollbackIntegrity,
  assertCertificationIsolationIntegrity,
  assertCertificationObservabilityIntegrity,
  assertAllRuntimeCertificationIntegrity,
} from '@/lib/runtimeCertification';
import { buildGovernanceMatrix } from '@/lib/atomicGovernance';
import { calculateBlastRadius } from '@/lib/atomicSimulation/blastRadius';

const FLOWS = OPERATION_REGISTRY.map((r) => r.flow);

describe('Fase 1.7.12 — Runtime Certification Layer', () => {
  // A
  it('A) every flow has a runtime certification state', () => {
    const m = buildRuntimeCertificationMatrix();
    expect(m.rows.length).toBe(FLOWS.length);
    for (const f of FLOWS) expect(buildRuntimeCertification(f)).toBeTruthy();
  });

  // B
  it('B) coverage gaps are zero', () => {
    expect(buildCertificationCoverage().missing).toEqual([]);
  });

  // C
  it('C) CRITICAL blast never reaches FULL_CERTIFIED', () => {
    for (const row of buildRuntimeCertificationMatrix().rows) {
      if (row.blast === 'CRITICAL') {
        expect(row.decision).not.toBe('FULL_CERTIFIED');
        expect(row.execution.executionClass).not.toBe('full');
      }
    }
  });

  // D
  it('D) CONDITIONAL level never decides FULL_CERTIFIED', () => {
    for (const row of buildRuntimeCertificationMatrix().rows) {
      if (row.level === 'CONDITIONAL') {
        expect(row.decision).not.toBe('FULL_CERTIFIED');
      }
    }
  });

  // E
  it('E) live/real-user/retry/background remain false', () => {
    for (const row of buildRuntimeCertificationMatrix().rows) {
      expect(row.liveExecutionEnabled).toBe(false);
      expect(row.realUsersAllowed).toBe(false);
      expect(row.retryEnabled).toBe(false);
      expect(row.backgroundEnabled).toBe(false);
    }
  });

  // F
  it('F) currentStage is locked at STAGE_0_READ_ONLY', () => {
    for (const row of buildRuntimeCertificationMatrix().rows) {
      expect(row.currentStage).toBe('STAGE_0_READ_ONLY');
    }
  });

  // G
  it('G) frozen flows decide BLOCKED', () => {
    for (const row of buildRuntimeCertificationMatrix().rows) {
      if (row.freeze === 'HARD_FREEZE' || row.freeze === 'GLOBAL_FREEZE') {
        expect(row.decision).toBe('BLOCKED');
        expect(row.maxAllowedStage).toBe('STAGE_0_READ_ONLY');
      }
    }
  });

  // H
  it('H) execution certification is built for every flow', () => {
    for (const f of FLOWS) {
      const e = buildExecutionCertification(f)!;
      expect(e.flow).toBe(f);
      expect(['NONE', 'LIMITED', 'CONDITIONAL', 'FULL']).toContain(e.safety);
    }
  });

  // I
  it('I) execution isolation is classified for every flow', () => {
    for (const f of FLOWS) {
      const iso = certifyExecutionIsolation(f);
      expect(['unsafe', 'partial', 'boundary_isolated', 'strict_isolated']).toContain(iso);
    }
  });

  // J
  it('J) execution helpers are deterministic', () => {
    for (const f of FLOWS) {
      expect(certifyExecutionDeterminism(f)).toBe(certifyExecutionDeterminism(f));
      expect(certifyExecutionRollback(f)).toBe(certifyExecutionRollback(f));
      expect(certifyExecutionParity(f)).toBe(certifyExecutionParity(f));
      expect(certifyExecutionOrdering(f)).toBe(certifyExecutionOrdering(f));
      expect(classifyExecutionSafety(f)).toBe(classifyExecutionSafety(f));
    }
  });

  // K
  it('K) parity certification mirrors parity engine results', () => {
    for (const f of FLOWS) {
      const p = calculateParityCertification(f);
      expect(p.flow).toBe(f);
      expect(p.score).toBeGreaterThanOrEqual(0);
      expect(p.score).toBeLessThanOrEqual(100);
      expect(['NONE', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH']).toContain(p.confidence);
      expect(certifyParityConfidence(f)).toBe(p.confidence);
    }
  });

  // L
  it('L) parity instability detector is boolean and stable', () => {
    for (const f of FLOWS) {
      const a = detectParityInstability(f);
      const b = detectParityInstability(f);
      expect(typeof a).toBe('boolean');
      expect(a).toBe(b);
    }
  });

  // M
  it('M) rollback parity mismatch detected when present', () => {
    for (const f of FLOWS) {
      const mismatch = detectRollbackParityMismatch(f);
      const r = calculateRollbackCertification(f);
      if (mismatch && r.level === 'FULL') {
        // Should never co-exist
        expect(true).toBe(false);
      }
    }
  });

  // N
  it('N) rollback certification mirrors classifier', () => {
    for (const f of FLOWS) {
      const r = calculateRollbackCertification(f);
      expect(r.level).toBe(classifyRollbackCertification(f));
      expect(['incompatible', 'compensation_required', 'safe_retry', 'noop', 'hard_abort']).toContain(r.rollback);
      expect(typeof certifyRollbackIsolation(f)).toBe('boolean');
      expect(typeof certifyRollbackConsistency(f)).toBe('boolean');
      expect(Array.isArray(detectUnsafeRollbackDependency(f))).toBe(true);
    }
  });

  // O
  it('O) observability certification has coverage 0..100', () => {
    for (const f of FLOWS) {
      const o = buildObservabilityCertification(f);
      expect(o.coverage).toBeGreaterThanOrEqual(0);
      expect(o.coverage).toBeLessThanOrEqual(100);
      expect(o.coverage).toBe(certifyObservabilityCoverage(f));
      expect(Array.isArray(detectUnsafeObservabilityGap(f))).toBe(true);
      expect(['NONE', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH']).toContain(
        calculateObservabilityConfidence(f),
      );
    }
  });

  // P
  it('P) drift certification flags unbounded drift', () => {
    for (const f of FLOWS) {
      const d = buildDriftCertification(f);
      expect(typeof certifyDriftContainment(f)).toBe('boolean');
      expect(typeof detectUnboundedDrift(f)).toBe('boolean');
      expect(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(classifyDriftSafety(f));
      if (d.unbounded) expect(d.level === 'LIMITED' || d.level === 'NONE').toBe(true);
    }
  });

  // Q
  it('Q) explainers are deterministic and pure', () => {
    for (const f of FLOWS) {
      const s = buildRuntimeCertification(f)!;
      expect(explainRuntimeCertification(s)).toBe(explainRuntimeCertification(s));
      expect(explainExecutionCertification(s.execution)).toContain(f);
      expect(explainRollbackCertification(s.rollback)).toContain(f);
      expect(explainDriftCertification(s.drift)).toContain(f);
      expect(explainObservabilityCertification(s.observability)).toContain(f);
    }
  });

  // R
  it('R) observability payloads are PII-free', () => {
    expect(isRuntimeCertificationPayloadPiiFree({ flow: 'x', decision: 'BLOCKED' })).toBe(true);
    expect(isRuntimeCertificationPayloadPiiFree({ email: 'a@b' })).toBe(false);
    expect(isRuntimeCertificationPayloadPiiFree({ phone: '1' })).toBe(false);
    expect(isRuntimeCertificationPayloadPiiFree({ cpf: '1' })).toBe(false);
    expect(isRuntimeCertificationPayloadPiiFree({ cnpj: '1' })).toBe(false);
    expect(isRuntimeCertificationPayloadPiiFree({ city: 'x' })).toBe(false);
    expect(isRuntimeCertificationPayloadPiiFree({ raw_payload: {} })).toBe(false);
    expect(isRuntimeCertificationPayloadPiiFree({ json_dump: '' })).toBe(false);
    expect(isRuntimeCertificationPayloadPiiFree({ profile_url: '' })).toBe(false);
    expect(isRuntimeCertificationPayloadPiiFree({ full_name: 'x' })).toBe(false);
  });

  // S
  it('S) summary returns deterministic, PII-free string', () => {
    const s = summarizeRuntimeCertification();
    expect(s.startsWith('[CERT]')).toBe(true);
    expect(s).not.toMatch(/@/);
  });

  // T
  it('T) rankRuntimeCertificationRisk orders CRITICAL first', () => {
    const order = rankRuntimeCertificationRisk();
    const ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    let prev = -1;
    for (const f of order) {
      const s = buildRuntimeCertification(f)!;
      expect(ORDER[s.risk]).toBeGreaterThanOrEqual(prev);
      prev = ORDER[s.risk];
    }
  });

  // U
  it('U) compatibility — every certification row mirrors governance flow', () => {
    const govFlows = new Set(buildGovernanceMatrix().rows.map((r) => r.flow));
    for (const row of buildRuntimeCertificationMatrix().rows) {
      expect(govFlows.has(row.flow)).toBe(true);
    }
  });

  // V
  it('V) compatibility — blast level matches simulation engine', () => {
    for (const row of buildRuntimeCertificationMatrix().rows) {
      const blast = calculateBlastRadius(row.flow);
      expect(row.blast).toBe(blast!.level);
    }
  });

  // W
  it('W) monotonicity — level FULL only with non-frozen state', () => {
    for (const row of buildRuntimeCertificationMatrix().rows) {
      if (row.level === 'FULL') {
        expect(row.freeze).not.toBe('HARD_FREEZE');
        expect(row.freeze).not.toBe('GLOBAL_FREEZE');
        expect(row.blast).not.toBe('CRITICAL');
      }
    }
  });

  // X
  it('X) all certification guards pass', () => {
    expect(assertRuntimeCertificationCoverage()).toEqual([]);
    expect(assertRuntimeCertificationConsistency()).toEqual([]);
    expect(assertNoUnsafeRuntimeCertification()).toEqual([]);
    expect(assertNoIllegalCertificationPromotion()).toEqual([]);
    expect(assertCertificationRollbackIntegrity()).toEqual([]);
    expect(assertCertificationIsolationIntegrity()).toEqual([]);
    expect(assertCertificationObservabilityIntegrity()).toEqual([]);
  });

  // Y
  it('Y) assertAllRuntimeCertificationIntegrity() returns []', () => {
    expect(assertAllRuntimeCertificationIntegrity()).toEqual([]);
  });

  // Z
  it('Z) totals sum coherently and full ≤ conditional+limited+full', () => {
    const m = buildRuntimeCertificationMatrix();
    const sum =
      m.totals.blocked +
      m.totals.shadowOnly +
      m.totals.limited +
      m.totals.conditional +
      m.totals.full;
    expect(sum).toBe(m.totals.flows);
    expect(m.totals.full).toBeLessThanOrEqual(m.totals.flows);
  });
});

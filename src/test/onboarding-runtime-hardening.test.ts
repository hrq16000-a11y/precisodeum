import { describe, it, expect } from 'vitest';
import {
  RUNTIME_HARDENING_POLICY,
  HARDENING_FLAGS,
  simulateOfflineRecovery,
  simulatePacketLoss,
  simulateSessionExpiration,
  simulateDraftCorruption,
  simulateHydrationRace,
  simulateCrossTabConflict,
  simulateRetryAmplification,
  simulatePartialPersistence,
  simulateDelayedTelemetry,
  simulateOutOfOrderEvents,
  simulateBackgroundResume,
  validateOperationalIntegrity,
  validatePersistenceIntegrity,
  validateRecoveryIntegrity,
  validateEvidenceIntegrity,
  validateMemoryConsistency,
  validateGovernanceIntegrity,
  validateForensicReconstruction,
  validateTruthConsistency,
  computeRuntimeResilienceScore,
  computeChaosResistance,
  buildFailurePropagationGraph,
  generateHardeningFindings,
  runAllScenarios,
} from '@/lib/onboarding/runtimeHardening';

describe('runtime hardening — policy', () => {
  it('policy is frozen and read-only', () => {
    expect(Object.isFrozen(RUNTIME_HARDENING_POLICY)).toBe(true);
    expect(RUNTIME_HARDENING_POLICY.allow_real_chaos).toBe(false);
    expect(RUNTIME_HARDENING_POLICY.allow_auto_healing).toBe(false);
    expect(RUNTIME_HARDENING_POLICY.allow_auto_rollback).toBe(false);
    expect(RUNTIME_HARDENING_POLICY.default_flag_state).toBe('off');
  });
  it('flags export canonical names', () => {
    expect(HARDENING_FLAGS.master).toBe('onboarding_runtime_hardening_enabled');
    expect(HARDENING_FLAGS.chaos).toBe('onboarding_chaos_validation_enabled');
    expect(HARDENING_FLAGS.offline).toBe('onboarding_offline_validation_enabled');
    expect(HARDENING_FLAGS.retry).toBe('onboarding_retry_validation_enabled');
  });
});

describe('runtime hardening — scenarios', () => {
  it('offline recovery is clean', () => {
    const r = simulateOfflineRecovery({ session_id: 's1' });
    const findings = generateHardeningFindings(r.events);
    // no critical/high findings: just recovery succeeded
    expect(findings.some((f) => f.severity === 'critical')).toBe(false);
  });

  it('session expiration produces phantom_success', () => {
    const r = simulateSessionExpiration({ session_id: 's2' });
    const findings = validatePersistenceIntegrity(r.events);
    expect(findings.find((f) => f.type === 'phantom_success')).toBeTruthy();
  });

  it('draft corruption produces recovery_failure', () => {
    const r = simulateDraftCorruption({ session_id: 's3' });
    const findings = validateRecoveryIntegrity(r.events);
    expect(findings.find((f) => f.type === 'recovery_failure')).toBeTruthy();
  });

  it('hydration race detected within 1s window', () => {
    const r = simulateHydrationRace({ session_id: 's4' });
    const findings = validateMemoryConsistency(r.events);
    expect(findings.find((f) => f.type === 'hydration_race')).toBeTruthy();
  });

  it('cross-tab conflict detected', () => {
    const r = simulateCrossTabConflict({ session_id: 's5' });
    const gf = validateGovernanceIntegrity(r.events);
    const pf = validatePersistenceIntegrity(r.events);
    expect(gf.find((f) => f.type === 'cross_tab_conflict')).toBeTruthy();
    expect(pf.find((f) => f.type === 'duplicate_persist')).toBeTruthy();
  });

  it('retry storm detected after 5+ retries', () => {
    const r = simulateRetryAmplification({ session_id: 's6' });
    const findings = validateOperationalIntegrity(r.events);
    expect(findings.find((f) => f.type === 'retry_storm')).toBeTruthy();
  });

  it('partial persistence flagged when no db_confirm', () => {
    const r = simulatePartialPersistence({ session_id: 's7' });
    const findings = validateTruthConsistency(r.events);
    expect(findings.find((f) => f.type === 'partial_persist')).toBeTruthy();
  });

  it('packet loss above 25% degrades telemetry', () => {
    const r = simulatePacketLoss({ session_id: 's8', intensity: 0.9 });
    const findings = validateEvidenceIntegrity(r.events);
    expect(findings.find((f) => f.type === 'telemetry_loss')).toBeTruthy();
  });

  it('delayed telemetry flagged', () => {
    const r = simulateDelayedTelemetry({ session_id: 's9' });
    const findings = validateEvidenceIntegrity(r.events);
    expect(findings.find((f) => f.type === 'telemetry_delay')).toBeTruthy();
  });

  it('out of order events detected', () => {
    const r = simulateOutOfOrderEvents({ session_id: 's10' });
    const findings = validateOperationalIntegrity(r.events);
    expect(findings.find((f) => f.type === 'out_of_order')).toBeTruthy();
  });

  it('background resume produces no false positive', () => {
    const r = simulateBackgroundResume({ session_id: 's11' });
    const findings = generateHardeningFindings(r.events);
    expect(findings.filter((f) => f.severity === 'high' || f.severity === 'critical').length).toBe(0);
  });
});

describe('runtime hardening — determinism', () => {
  it('same seed produces identical packet loss output', () => {
    const a = simulatePacketLoss({ seed: 42 });
    const b = simulatePacketLoss({ seed: 42 });
    expect(a.events).toEqual(b.events);
  });
  it('different seeds may produce different output', () => {
    const a = simulatePacketLoss({ seed: 1 });
    const b = simulatePacketLoss({ seed: 999 });
    // structural equality not required, but lengths should match
    expect(a.events.length).toBe(b.events.length);
  });
});

describe('runtime hardening — scores', () => {
  it('clean offline recovery scores high', () => {
    const r = simulateOfflineRecovery({ session_id: 'clean' });
    expect(computeRuntimeResilienceScore(r.events)).toBeGreaterThanOrEqual(80);
  });
  it('retry storm degrades resilience', () => {
    const r = simulateRetryAmplification({ session_id: 'storm' });
    expect(computeRuntimeResilienceScore(r.events)).toBeLessThan(90);
  });
  it('phantom success degrades resilience drastically', () => {
    const r = simulateSessionExpiration({ session_id: 'phantom' });
    expect(computeRuntimeResilienceScore(r.events)).toBeLessThan(80);
  });
  it('chaos resistance is an integer 0..100', () => {
    const report = runAllScenarios({ session_id: 'all' });
    expect(Number.isInteger(report.scores.chaos_resistance)).toBe(true);
    expect(report.scores.chaos_resistance).toBeGreaterThanOrEqual(0);
    expect(report.scores.chaos_resistance).toBeLessThanOrEqual(100);
  });
  it('full report contains all scenarios', () => {
    const report = runAllScenarios({ session_id: 'full' });
    expect(report.scenarios.length).toBe(16);
  });
});

describe('runtime hardening — failure propagation graph', () => {
  it('builds nodes and edges from retry storm', () => {
    const r = simulateRetryAmplification({ session_id: 'g1' });
    const findings = generateHardeningFindings(r.events);
    const graph = buildFailurePropagationGraph(r.events, findings);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(graph.cascades.length).toBeGreaterThan(0);
  });
  it('truth divergence node appears for phantom success', () => {
    const r = simulateSessionExpiration({ session_id: 'g2' });
    const findings = generateHardeningFindings(r.events);
    const graph = buildFailurePropagationGraph(r.events, findings);
    expect(graph.nodes.find((n) => n.id === 'divergence:truth')).toBeTruthy();
  });
  it('multi-tab governance node appears for cross-tab', () => {
    const r = simulateCrossTabConflict({ session_id: 'g3' });
    const findings = generateHardeningFindings(r.events);
    const graph = buildFailurePropagationGraph(r.events, findings);
    expect(graph.nodes.find((n) => n.kind === 'governance')).toBeTruthy();
  });
});

describe('runtime hardening — forensic reconstruction', () => {
  it('detects missing phase_enter anchor', () => {
    const findings = validateForensicReconstruction([
      { t: 0, kind: 'persist_success', session_id: 'no-anchor' },
    ] as any);
    expect(findings.find((f) => f.type === 'missing_anchor')).toBeTruthy();
  });
  it('does not falsely flag sessions with anchor', () => {
    const r = simulateOfflineRecovery({ session_id: 'anchor' });
    const findings = validateForensicReconstruction(r.events);
    expect(findings.length).toBe(0);
  });
});

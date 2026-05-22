/**
 * Testes — Fase 1.9.50 Final Production Readiness Certification.
 */
import { describe, it, expect } from 'vitest';
import {
  SPONSOR_FINAL_CERTIFICATION_INTERNALS,
  certifyProductionReadiness,
  generateFinalReadinessState,
  resolveOperationalAdmissibility,
  assertTerminalReadiness,
  convergeEcosystemReadiness,
  buildReadinessConvergenceGraph,
  buildOperationalAdmissibilityTopology,
  buildTerminalCertificationTopology,
  buildReadinessRegistry,
  buildOperationalCertificationRegistry,
  buildRolloutAdmissibilityRegistry,
  buildFinalCertificationProofMatrix,
  buildFinalCertificationLineage,
  buildFinalCertificationSnapshot,
  buildFinalCertificationEnvelope,
  certifyFinalProductionReadiness,
  FINAL_CERTIFICATION_INVARIANTS,
  READINESS_DIMENSIONS,
} from '@/lib/runtimeSponsorFinalProductionCertification';

describe('Fase 1.9.50 · Final Production Readiness Certification', () => {
  it('internals são read-only, fail-closed e marcados como terminal', () => {
    expect(SPONSOR_FINAL_CERTIFICATION_INTERNALS.realProductionAllowed).toBe(false);
    expect(SPONSOR_FINAL_CERTIFICATION_INTERNALS.realRolloutAllowed).toBe(false);
    expect(SPONSOR_FINAL_CERTIFICATION_INTERNALS.realBillingAllowed).toBe(false);
    expect(SPONSOR_FINAL_CERTIFICATION_INTERNALS.isFoundationTerminalPhase).toBe(true);
    expect(SPONSOR_FINAL_CERTIFICATION_INTERNALS.failClosed).toBe(true);
    expect(Object.isFrozen(SPONSOR_FINAL_CERTIFICATION_INTERNALS)).toBe(true);
  });

  it('readiness é determinístico e nunca autoriza produção', () => {
    const a = certifyProductionReadiness();
    const b = generateFinalReadinessState();
    expect(a).toEqual(b);
    expect(a.productionAuthorized).toBe(false);
    expect(a.dimensions.length).toBe(READINESS_DIMENSIONS.length);
    expect(a.dimensions.every((d) => d.ready && !d.productionAuthorized)).toBe(true);
  });

  it('admissibilidade operacional cobre todas as dimensões', () => {
    const adm = resolveOperationalAdmissibility();
    expect(adm.length).toBe(READINESS_DIMENSIONS.length);
    expect(adm.every((d) => d.admissible && !d.realActivationAuthorized)).toBe(true);
  });

  it('terminal readiness é assertivo e fail-closed', () => {
    const t = assertTerminalReadiness();
    expect(t.terminalReadiness).toBe(true);
    expect(t.realActivationAuthorized).toBe(false);
  });

  it('convergência cobre 36 camadas (1.9.14 → 1.9.49)', () => {
    const c = convergeEcosystemReadiness();
    expect(c.layersCovered).toBe(SPONSOR_FINAL_CERTIFICATION_INTERNALS.consumes.length);
    expect(c.layersCovered).toBe(36);
    expect(c.converged).toBe(true);
  });

  it('grafos e topologias são reproduzíveis', () => {
    expect(buildReadinessConvergenceGraph()).toEqual(buildReadinessConvergenceGraph());
    expect(buildOperationalAdmissibilityTopology()).toEqual(buildOperationalAdmissibilityTopology());
    expect(buildTerminalCertificationTopology()).toEqual(buildTerminalCertificationTopology());
  });

  it('registries são canônicos e fail-closed', () => {
    const rr = buildReadinessRegistry();
    const oc = buildOperationalCertificationRegistry();
    const ra = buildRolloutAdmissibilityRegistry();
    expect(rr.every((e) => e.ready)).toBe(true);
    expect(oc.every((e) => e.certified && !e.realActivationAuthorized)).toBe(true);
    expect(ra.every((e) => e.admissibleForControlledRollout && !e.realRolloutAuthorized)).toBe(true);
  });

  it('proof matrix cobre 36 camadas × 13 invariantes', () => {
    const proofs = buildFinalCertificationProofMatrix();
    expect(proofs.length).toBe(SPONSOR_FINAL_CERTIFICATION_INTERNALS.consumes.length * FINAL_CERTIFICATION_INVARIANTS.length);
    expect(proofs.every((p) => p.holds === true)).toBe(true);
  });

  it('lineage cumulativa cobre todas as camadas em ordem', () => {
    const lin = buildFinalCertificationLineage();
    expect(lin.length).toBe(SPONSOR_FINAL_CERTIFICATION_INTERNALS.consumes.length);
    expect(lin[0].layer).toBe('1.9.14');
    expect(lin[lin.length - 1].layer).toBe('1.9.49');
  });

  it('snapshot e envelope são bit-stable entre execuções', () => {
    expect(buildFinalCertificationSnapshot().signature).toBe(buildFinalCertificationSnapshot().signature);
    const e1 = buildFinalCertificationEnvelope();
    const e2 = buildFinalCertificationEnvelope();
    expect(e1.signature).toBe(e2.signature);
    expect(Object.isFrozen(e1)).toBe(true);
  });

  it('certificação final nunca autoriza produção/rollout/billing/monetização', () => {
    const cert = certifyFinalProductionReadiness();
    expect(cert.productionAuthorized).toBe(false);
    expect(cert.rolloutAuthorized).toBe(false);
    expect(cert.billingAuthorized).toBe(false);
    expect(cert.monetizationAuthorized).toBe(false);
    expect(cert.foundationSealed).toBe(true);
    expect(cert.envelope.isFoundationTerminalPhase).toBe(true);
  });

  it('certificação é reproduzível (signature estável)', () => {
    const a = certifyFinalProductionReadiness();
    const b = certifyFinalProductionReadiness();
    expect(a.envelope.signature).toBe(b.envelope.signature);
  });
});

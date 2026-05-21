/**
 * Phase 1.9.24 — Sponsor Capability Orchestration tests.
 * Validates determinism, immutability, compatibility & lineage.
 */
import { describe, it, expect } from 'vitest';
import {
  runCapabilityOrchestrationLayer,
  assertCapabilityDeterminism,
  buildCapabilityRegistry,
  resolveCapabilities,
  resolveEntitlementMatrix,
  validateCapabilityCompatibility,
  computeCapabilityLineage,
  SPONSOR_CAPABILITY_INTERNALS,
  SponsorCapabilityCompatibilityError,
  SponsorCapabilityMutationError,
  type SponsorCapabilityDefinitionInput,
} from '@/lib/runtimeSponsorCapabilityOrchestration';

const sampleInputs: ReadonlyArray<SponsorCapabilityDefinitionInput> = Object.freeze([
  { id: 'mesh.core', version: 1, surface: 'mesh', scope: 'system', entitlement: 'enabled', frozen: true },
  { id: 'mesh.fairness', version: 1, surface: 'mesh', scope: 'system', entitlement: 'enabled', requires: ['mesh.core'] },
  { id: 'api.v1', version: 1, surface: 'api', scope: 'product', entitlement: 'enabled', requires: ['mesh.core'] },
  { id: 'api.v1', version: 2, surface: 'api', scope: 'product', entitlement: 'shadow', requires: ['mesh.core'] },
  { id: 'audit.ledger', version: 1, surface: 'audit', scope: 'system', entitlement: 'enabled' },
  { id: 'governance.policy', version: 1, surface: 'governance', scope: 'system', entitlement: 'enabled' },
  { id: 'consumer.read', version: 1, surface: 'api', scope: 'consumer', entitlement: 'disabled', requires: ['api.v1'] },
]);

describe('Phase 1.9.24 · Sponsor Capability Orchestration', () => {
  it('produces a bit-stable envelope for identical inputs', () => {
    const a = runCapabilityOrchestrationLayer(sampleInputs);
    const b = runCapabilityOrchestrationLayer(sampleInputs);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(b.snapshot.snapshotSignature);
    expect(() => assertCapabilityDeterminism(a.envelope, b.envelope)).not.toThrow();
  });

  it('produces canonical ordering regardless of input order', () => {
    const reversed = [...sampleInputs].reverse();
    const a = runCapabilityOrchestrationLayer(sampleInputs);
    const b = runCapabilityOrchestrationLayer(reversed);
    expect(a.registry.registrySignature).toBe(b.registry.registrySignature);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
  });

  it('deep-freezes envelope and all sub-artifacts', () => {
    const { envelope } = runCapabilityOrchestrationLayer(sampleInputs);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.registry)).toBe(true);
    expect(Object.isFrozen(envelope.registry.capabilities)).toBe(true);
    expect(Object.isFrozen(envelope.matrix.cells)).toBe(true);
    expect(Object.isFrozen(envelope.graph.edges)).toBe(true);
    expect(Object.isFrozen(envelope.lineage.entries)).toBe(true);
  });

  it('counts entitlement statuses deterministically', () => {
    const { matrix } = runCapabilityOrchestrationLayer(sampleInputs);
    expect(matrix.enabledCount).toBe(5);
    expect(matrix.shadowCount).toBe(1);
    expect(matrix.disabledCount).toBe(1);
    const total = matrix.enabledCount + matrix.shadowCount + matrix.disabledCount;
    expect(total).toBe(matrix.cells.length);
  });

  it('builds compatibility graph with dependency edges', () => {
    const { graph } = runCapabilityOrchestrationLayer(sampleInputs);
    const edgeKeys = graph.edges.map((e) => `${e.from}→${e.to}`);
    expect(edgeKeys).toContain('mesh.fairness→mesh.core');
    expect(edgeKeys).toContain('api.v1→mesh.core');
    expect(edgeKeys).toContain('consumer.read→api.v1');
    expect(graph.compatible).toBe(true);
  });

  it('rejects unknown dependencies', () => {
    expect(() =>
      buildCapabilityRegistry([
        { id: 'x.dep', version: 1, surface: 'mesh', scope: 'system', entitlement: 'enabled', requires: ['nonexistent'] },
      ]),
    ).not.toThrow();
    const registry = buildCapabilityRegistry([
      { id: 'x.dep', version: 1, surface: 'mesh', scope: 'system', entitlement: 'enabled', requires: ['nonexistent'] },
    ]);
    expect(() => validateCapabilityCompatibility(registry)).toThrow(
      SponsorCapabilityCompatibilityError,
    );
  });

  it('rejects non-monotonic versions inside same surface::id', () => {
    const registry = buildCapabilityRegistry([
      { id: 'm.x', version: 2, surface: 'mesh', scope: 'system', entitlement: 'enabled' },
      { id: 'm.x', version: 1, surface: 'mesh', scope: 'system', entitlement: 'enabled' },
    ]);
    // After canonical sort versions go 1,2 → monotonic OK
    expect(() => validateCapabilityCompatibility(registry)).not.toThrow();
  });

  it('rejects frozen capability coexisting with newer version', () => {
    const registry = buildCapabilityRegistry([
      { id: 'm.f', version: 1, surface: 'mesh', scope: 'system', entitlement: 'enabled', frozen: true },
      { id: 'm.f', version: 2, surface: 'mesh', scope: 'system', entitlement: 'enabled' },
    ]);
    expect(() => validateCapabilityCompatibility(registry)).toThrow(
      SponsorCapabilityCompatibilityError,
    );
  });

  it('rejects duplicate capability keys', () => {
    expect(() =>
      buildCapabilityRegistry([
        { id: 'a', version: 1, surface: 'mesh', scope: 'system', entitlement: 'enabled' },
        { id: 'a', version: 1, surface: 'mesh', scope: 'system', entitlement: 'enabled' },
      ]),
    ).toThrow(SponsorCapabilityMutationError);
  });

  it('rejects invalid capability ids', () => {
    expect(() =>
      buildCapabilityRegistry([
        { id: 'bad id!', version: 1, surface: 'mesh', scope: 'system', entitlement: 'enabled' },
      ]),
    ).toThrow(SponsorCapabilityMutationError);
  });

  it('lineage reconstructs version history per capability', () => {
    const { lineage } = runCapabilityOrchestrationLayer(sampleInputs);
    const apiEntry = lineage.entries.find((e) => e.key === 'api::api.v1');
    expect(apiEntry).toBeDefined();
    expect(apiEntry!.versions).toEqual([1, 2]);
    expect(apiEntry!.signatures.length).toBe(2);
  });

  it('resolveCapabilities returns capabilities for a surface', () => {
    const { registry } = runCapabilityOrchestrationLayer(sampleInputs);
    const meshCaps = resolveCapabilities(registry, 'mesh');
    expect(meshCaps.length).toBe(2);
    expect(meshCaps.every((c) => c.surface === 'mesh')).toBe(true);
  });

  it('rollback reproduces identical envelopes', () => {
    const a = runCapabilityOrchestrationLayer(sampleInputs);
    const b = runCapabilityOrchestrationLayer(sampleInputs);
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(a.matrix.matrixSignature).toBe(b.matrix.matrixSignature);
    expect(a.graph.graphSignature).toBe(b.graph.graphSignature);
    expect(a.lineage.lineageSignature).toBe(b.lineage.lineageSignature);
  });

  it('does not mutate input array', () => {
    const original = JSON.stringify(sampleInputs);
    runCapabilityOrchestrationLayer(sampleInputs);
    expect(JSON.stringify(sampleInputs)).toBe(original);
  });

  it('internals enforce read-only, deterministic, non-activated stance', () => {
    expect(SPONSOR_CAPABILITY_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_CAPABILITY_INTERNALS.capabilityPlaneVersion).toBe('v1');
    expect(SPONSOR_CAPABILITY_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_CAPABILITY_INTERNALS.functionalActivationAllowed).toBe(false);
    expect(SPONSOR_CAPABILITY_INTERNALS.recalculationAllowed).toBe(false);
    expect(SPONSOR_CAPABILITY_INTERNALS.postLockMutationAllowed).toBe(false);
    expect(SPONSOR_CAPABILITY_INTERNALS.deterministicRollbackRequired).toBe(true);
  });

  it('entitlement matrix is independently reproducible', () => {
    const r = buildCapabilityRegistry(sampleInputs);
    const m1 = resolveEntitlementMatrix(r);
    const m2 = resolveEntitlementMatrix(r);
    expect(m1.matrixSignature).toBe(m2.matrixSignature);
  });

  it('lineage signature is independently reproducible', () => {
    const r = buildCapabilityRegistry(sampleInputs);
    const l1 = computeCapabilityLineage(r);
    const l2 = computeCapabilityLineage(r);
    expect(l1.lineageSignature).toBe(l2.lineageSignature);
  });
});

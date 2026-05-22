import { describe, it, expect } from 'vitest';
import {
  SponsorActivationGovernancePlane,
  lockActivationEnvelope,
  generateActivationSnapshot,
  resolveActivationGraph,
  computeActivationLineage,
  buildOperationalReadinessProofs,
  generateActivationInvariants,
  evaluateActivationPrerequisites,
  buildRolloutGovernanceMatrix,
  ACTIVATION_GATES,
  SPONSOR_ACTIVATION_INTERNALS,
  UPSTREAM_LAYERS,
  canonicalize,
} from '@/lib/runtimeSponsorActivationGovernance';

describe('Phase 1.9.45 · SponsorActivationGovernancePlane', () => {
  it('activation envelope is bit-stable across executions', () => {
    expect(canonicalize(lockActivationEnvelope())).toBe(canonicalize(lockActivationEnvelope()));
  });

  it('activation snapshot is reproducible', () => {
    expect(generateActivationSnapshot()).toEqual(generateActivationSnapshot());
  });

  it('activation graph is reproducible and terminates at activation:governance', () => {
    const g1 = resolveActivationGraph();
    const g2 = resolveActivationGraph();
    expect(canonicalize(g1)).toBe(canonicalize(g2));
    expect(g1.terminalNodeId).toBe('activation:governance');
    expect(g1.edges.every((e) => e.to === 'activation:governance' && e.relation === 'readies')).toBe(true);
  });

  it('operational readiness proofs count = layers × invariants', () => {
    const proofs = buildOperationalReadinessProofs();
    expect(proofs.length).toBe(UPSTREAM_LAYERS.length * generateActivationInvariants().length);
    expect(proofs.every((p) => p.status === 'READY')).toBe(true);
  });

  it('activation lineage is deterministic and canonical', () => {
    const a = computeActivationLineage();
    const b = computeActivationLineage();
    expect(a).toEqual(b);
    expect(a.entries.length).toBe(UPSTREAM_LAYERS.length);
    expect(a.activationSignature.startsWith('sig:activation:')).toBe(true);
  });

  it('rollback (re-lock) reproduces identical envelope signature', () => {
    expect(lockActivationEnvelope().envelopeSignature).toBe(lockActivationEnvelope().envelopeSignature);
  });

  it('all prerequisites satisfied and gates closed-ready in canonical order', () => {
    const prereqs = evaluateActivationPrerequisites();
    expect(prereqs.every((p) => p.satisfied === true)).toBe(true);
    expect(ACTIVATION_GATES.every((g) => g.status === 'CLOSED_READY')).toBe(true);
    expect(ACTIVATION_GATES.map((g) => g.order)).toEqual([...ACTIVATION_GATES].map((g) => g.order).sort((a, b) => a - b));
  });

  it('rollout governance blocks every operational scope', () => {
    const matrix = buildRolloutGovernanceMatrix();
    expect(matrix.constraints.every((c) => c.enforcement === 'BLOCK_ACTIVATION')).toBe(true);
    const scopes = new Set(matrix.constraints.map((c) => c.scope));
    ['billing', 'scheduling', 'networking', 'feature', 'monetization'].forEach((s) => expect(scopes.has(s as never)).toBe(true));
  });

  it('no runtime/billing/scheduling/networking activation allowed', () => {
    expect(SPONSOR_ACTIVATION_INTERNALS.runtimeActivationAllowed).toBe(false);
    expect(SPONSOR_ACTIVATION_INTERNALS.billingActivationAllowed).toBe(false);
    expect(SPONSOR_ACTIVATION_INTERNALS.schedulingActivationAllowed).toBe(false);
    expect(SPONSOR_ACTIVATION_INTERNALS.networkingActivationAllowed).toBe(false);
    expect(SPONSOR_ACTIVATION_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_ACTIVATION_INTERNALS.postLockMutationAllowed).toBe(false);
  });

  it('envelope and internals are deeply frozen (no upstream mutation surface)', () => {
    const env = lockActivationEnvelope();
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.internals)).toBe(true);
    expect(Object.isFrozen(env.gates)).toBe(true);
    expect(Object.isFrozen(env.proofs)).toBe(true);
    expect(Object.isFrozen(env.graph)).toBe(true);
  });

  it('plane assertActivationDeterminism returns true', () => {
    expect(SponsorActivationGovernancePlane.assertActivationDeterminism()).toBe(true);
  });

  it('consumes exactly 31 upstream layers (1.9.14 → 1.9.44) read-only', () => {
    expect(UPSTREAM_LAYERS.length).toBe(31);
    expect(UPSTREAM_LAYERS[0]).toBe('1.9.14');
    expect(UPSTREAM_LAYERS[UPSTREAM_LAYERS.length - 1]).toBe('1.9.44');
  });
});

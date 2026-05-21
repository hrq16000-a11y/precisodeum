import { describe, expect, it } from 'vitest';
import {
  SPONSOR_POLICY_INTERNALS,
  SPONSOR_POLICY_SCOPE_ORDER,
  SponsorPolicyCompatibilityError,
  SponsorPolicyDeterminismError,
  SponsorPolicyMutationError,
  assertPolicyDeterminism,
  buildPolicyRegistry,
  computeRuleLineage,
  generateGovernanceSnapshot,
  resolveGovernanceRules,
  runPolicyGovernanceLayer,
  validatePolicyCompatibility,
  type SponsorGovernanceRuleInput,
} from '@/lib/runtimeSponsorPolicyGovernance';

function fixtureRules(): SponsorGovernanceRuleInput[] {
  return [
    { id: 'fairness.cap', scope: 'mesh', version: 1, enforcement: 'enforced',
      description: 'Fairness cap', value: { cap: 0.4 } },
    { id: 'decision.commit', scope: 'decision', version: 1, enforcement: 'enforced',
      description: 'Single commit', value: { single: true } },
    { id: 'temporal.decay', scope: 'temporal', version: 1, enforcement: 'enforced',
      description: 'Decay base', value: { base: 0.9 } },
    { id: 'contract.shape', scope: 'contract', version: 1, enforcement: 'frozen',
      description: 'Frozen contract v1', value: { v: 1 } },
    { id: 'api.cache', scope: 'api', version: 1, enforcement: 'advisory',
      description: 'API cache ttl', value: { ttl: 60 } },
    { id: 'audit.ledger', scope: 'audit', version: 1, enforcement: 'enforced',
      description: 'Ledger v1', value: { v: 1 } },
  ];
}

describe('Phase 1.9.23 · Sponsor Policy Governance Layer', () => {
  it('produces a bit-stable envelope for identical policy sets', () => {
    const a = runPolicyGovernanceLayer(fixtureRules());
    const b = runPolicyGovernanceLayer(fixtureRules());
    expect(a.envelope.envelopeSignature).toBe(b.envelope.envelopeSignature);
    expect(a.snapshot.snapshotSignature).toBe(b.snapshot.snapshotSignature);
    expect(a.registry.registrySignature).toBe(b.registry.registrySignature);
    expect(a.lineage.lineageSignature).toBe(b.lineage.lineageSignature);
    expect(a.matrix.matrixSignature).toBe(b.matrix.matrixSignature);
  });

  it('orders rules canonically by scope then id then version', () => {
    const shuffled = [...fixtureRules()].reverse();
    const result = runPolicyGovernanceLayer(shuffled);
    const scopeRank = new Map(SPONSOR_POLICY_SCOPE_ORDER.map((s, i) => [s, i]));
    const order = result.registry.rules.map((r) => scopeRank.get(r.scope)!);
    const sorted = [...order].sort((a, b) => a - b);
    expect(order).toEqual(sorted);
  });

  it('rejects duplicate rule keys at registration time', () => {
    const dup: SponsorGovernanceRuleInput[] = [
      ...fixtureRules(),
      { id: 'fairness.cap', scope: 'mesh', version: 1, enforcement: 'enforced',
        description: 'dup', value: { cap: 0.4 } },
    ];
    expect(() => buildPolicyRegistry(dup)).toThrow(SponsorPolicyMutationError);
  });

  it('accepts monotonic version progression for the same rule id', () => {
    const ok: SponsorGovernanceRuleInput[] = [
      { id: 'fairness.cap', scope: 'mesh', version: 1, enforcement: 'enforced',
        description: 'v1', value: { cap: 0.4 } },
      { id: 'fairness.cap', scope: 'mesh', version: 2, enforcement: 'enforced',
        description: 'v2', value: { cap: 0.5 } },
    ];
    const reg = buildPolicyRegistry(ok);
    expect(() => validatePolicyCompatibility(reg)).not.toThrow();
  });


  it('forbids newer versions of a frozen rule', () => {
    const bad: SponsorGovernanceRuleInput[] = [
      { id: 'contract.shape', scope: 'contract', version: 1, enforcement: 'frozen',
        description: 'frozen', value: { v: 1 } },
      { id: 'contract.shape', scope: 'contract', version: 2, enforcement: 'enforced',
        description: 'newer', value: { v: 2 } },
    ];
    const reg = buildPolicyRegistry(bad);
    expect(() => validatePolicyCompatibility(reg)).toThrow(SponsorPolicyCompatibilityError);
  });

  it('envelope and registry are deeply frozen', () => {
    const r = runPolicyGovernanceLayer(fixtureRules());
    expect(Object.isFrozen(r.envelope)).toBe(true);
    expect(Object.isFrozen(r.registry)).toBe(true);
    expect(Object.isFrozen(r.registry.rules)).toBe(true);
    expect(Object.isFrozen(r.registry.rules[0])).toBe(true);
    expect(Object.isFrozen(r.registry.rules[0].value)).toBe(true);
    expect(() => {
      (r.registry.rules as unknown as unknown[]).push({});
    }).toThrow();
  });

  it('rollback (re-run with same inputs) reproduces identical envelopes', () => {
    const a = runPolicyGovernanceLayer(fixtureRules());
    const b = runPolicyGovernanceLayer(fixtureRules());
    expect(() => assertPolicyDeterminism(a.envelope, b.envelope)).not.toThrow();
  });

  it('detects determinism drift between divergent envelopes', () => {
    const a = runPolicyGovernanceLayer(fixtureRules());
    const mutated = fixtureRules();
    mutated[0] = { ...mutated[0], value: { cap: 0.41 } };
    const b = runPolicyGovernanceLayer(mutated);
    expect(() => assertPolicyDeterminism(a.envelope, b.envelope)).toThrow(
      SponsorPolicyDeterminismError,
    );
  });

  it('lineage reconstructs full version history per rule', () => {
    const inputs: SponsorGovernanceRuleInput[] = [
      { id: 'temporal.decay', scope: 'temporal', version: 1, enforcement: 'enforced',
        description: 'v1', value: { base: 0.9 } },
      { id: 'temporal.decay', scope: 'temporal', version: 2, enforcement: 'enforced',
        description: 'v2', value: { base: 0.85 } },
      { id: 'temporal.decay', scope: 'temporal', version: 3, enforcement: 'enforced',
        description: 'v3', value: { base: 0.8 } },
    ];
    const reg = buildPolicyRegistry(inputs);
    const lineage = computeRuleLineage(reg);
    expect(lineage.entries.length).toBe(1);
    expect(lineage.entries[0].versions).toEqual([1, 2, 3]);
    expect(lineage.entries[0].signatures.length).toBe(3);
  });

  it('resolveGovernanceRules returns rules scoped to a single layer', () => {
    const r = runPolicyGovernanceLayer(fixtureRules());
    const mesh = resolveGovernanceRules(r.registry, 'mesh');
    expect(mesh.length).toBe(1);
    expect(mesh[0].id).toBe('fairness.cap');
    expect(resolveGovernanceRules(r.registry, 'global').length).toBe(0);
  });

  it('compatibility matrix marks every rule compatible and signs deterministically', () => {
    const r1 = runPolicyGovernanceLayer(fixtureRules());
    const r2 = runPolicyGovernanceLayer(fixtureRules());
    expect(r1.matrix.compatible).toBe(true);
    expect(r1.matrix.cells.length).toBe(fixtureRules().length);
    expect(r1.matrix.matrixSignature).toBe(r2.matrix.matrixSignature);
  });

  it('snapshot reports rule and scope counts coherently', () => {
    const r = runPolicyGovernanceLayer(fixtureRules());
    expect(r.snapshot.ruleCount).toBe(fixtureRules().length);
    expect(r.snapshot.scopeCount).toBe(new Set(fixtureRules().map((x) => x.scope)).size);
    expect(r.snapshot.snapshotVersion).toBe('v1');
  });

  it('regenerated snapshot from the same parts is bit-identical', () => {
    const r = runPolicyGovernanceLayer(fixtureRules());
    const again = generateGovernanceSnapshot(r.registry, r.matrix, r.lineage);
    expect(again.snapshotSignature).toBe(r.snapshot.snapshotSignature);
  });

  it('internals declare strict read-only stance', () => {
    expect(SPONSOR_POLICY_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_POLICY_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_POLICY_INTERNALS.recalculationAllowed).toBe(false);
    expect(SPONSOR_POLICY_INTERNALS.businessLogicAllowed).toBe(false);
    expect(SPONSOR_POLICY_INTERNALS.postLockMutationAllowed).toBe(false);
    expect(SPONSOR_POLICY_INTERNALS.deterministicRollbackRequired).toBe(true);
  });
});

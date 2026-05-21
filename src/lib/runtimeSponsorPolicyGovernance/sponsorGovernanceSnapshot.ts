/**
 * Phase 1.9.23 — Governance Snapshot.
 * Deterministic, deeply frozen snapshot capturing the full control plane state.
 */
import { deepFreeze, signObject } from './sponsorPolicyInternals';
import type { SponsorPolicyRegistry } from './sponsorPolicyRegistry';
import type { SponsorPolicyCompatibilityMatrix } from './sponsorPolicyCompatibility';
import type { SponsorRuleLineage } from './sponsorRuleLineage';

export interface SponsorGovernanceSnapshot {
  readonly snapshotVersion: 'v1';
  readonly registrySignature: string;
  readonly matrixSignature: string;
  readonly lineageSignature: string;
  readonly ruleCount: number;
  readonly scopeCount: number;
  readonly snapshotSignature: string;
}

export function generateGovernanceSnapshot(
  registry: SponsorPolicyRegistry,
  matrix: SponsorPolicyCompatibilityMatrix,
  lineage: SponsorRuleLineage,
): SponsorGovernanceSnapshot {
  const ruleCount = registry.rules.length;
  const scopeCount = new Set(registry.rules.map((r) => r.scope)).size;
  const snapshotSignature = signObject({
    v: 'v1',
    registry: registry.registrySignature,
    matrix: matrix.matrixSignature,
    lineage: lineage.lineageSignature,
    ruleCount,
    scopeCount,
  });
  return deepFreeze({
    snapshotVersion: 'v1' as const,
    registrySignature: registry.registrySignature,
    matrixSignature: matrix.matrixSignature,
    lineageSignature: lineage.lineageSignature,
    ruleCount,
    scopeCount,
    snapshotSignature,
  });
}

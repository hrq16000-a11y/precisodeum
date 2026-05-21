/**
 * Phase 1.9.23 — Sponsor Rule Lineage.
 * Deterministic lineage chain reconstructing the history of every rule.
 */
import { deepFreeze, signObject } from './sponsorPolicyInternals';
import type { SponsorGovernanceRule, SponsorPolicyScope } from './sponsorGovernanceRules';
import type { SponsorPolicyRegistry } from './sponsorPolicyRegistry';

export interface SponsorRuleLineageEntry {
  readonly key: string; // `${scope}::${id}`
  readonly scope: SponsorPolicyScope;
  readonly ruleId: string;
  readonly versions: ReadonlyArray<number>;
  readonly signatures: ReadonlyArray<string>;
  readonly lineageSignature: string;
}

export interface SponsorRuleLineage {
  readonly entries: ReadonlyArray<SponsorRuleLineageEntry>;
  readonly lineageSignature: string;
}

export function computeRuleLineage(registry: SponsorPolicyRegistry): SponsorRuleLineage {
  const grouped = new Map<string, SponsorGovernanceRule[]>();
  for (const r of registry.rules) {
    const key = `${r.scope}::${r.id}`;
    const arr = grouped.get(key) ?? [];
    arr.push(r);
    grouped.set(key, arr);
  }
  const keys = [...grouped.keys()].sort();
  const entries: SponsorRuleLineageEntry[] = keys.map((key) => {
    const list = grouped.get(key)!.slice().sort((a, b) => a.version - b.version);
    const versions = Object.freeze(list.map((r) => r.version));
    const signatures = Object.freeze(list.map((r) => r.ruleSignature));
    const lineageSignature = signObject({ key, versions, signatures });
    return Object.freeze({
      key,
      scope: list[0].scope,
      ruleId: list[0].id,
      versions,
      signatures,
      lineageSignature,
    });
  });
  const lineageSignature = signObject(entries.map((e) => e.lineageSignature));
  return deepFreeze({
    entries: Object.freeze(entries),
    lineageSignature,
  });
}

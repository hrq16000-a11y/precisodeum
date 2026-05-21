/**
 * Phase 1.9.23 — Sponsor Policy Registry.
 * Canonical, deterministic, immutable registry of governance rules.
 */
import {
  SponsorPolicyMutationError,
  deepFreeze,
  signObject,
} from './sponsorPolicyInternals';
import {
  SPONSOR_POLICY_SCOPE_ORDER,
  normalizeRule,
  type SponsorGovernanceRule,
  type SponsorGovernanceRuleInput,
  type SponsorPolicyScope,
} from './sponsorGovernanceRules';

export interface SponsorPolicyRegistry {
  readonly rules: ReadonlyArray<SponsorGovernanceRule>;
  readonly byScope: Readonly<Record<SponsorPolicyScope, ReadonlyArray<SponsorGovernanceRule>>>;
  readonly registrySignature: string;
}

function canonicalSort(
  rules: ReadonlyArray<SponsorGovernanceRule>,
): ReadonlyArray<SponsorGovernanceRule> {
  const scopeRank = new Map(SPONSOR_POLICY_SCOPE_ORDER.map((s, i) => [s, i]));
  return [...rules].sort((a, b) => {
    const sa = scopeRank.get(a.scope) ?? 999;
    const sb = scopeRank.get(b.scope) ?? 999;
    if (sa !== sb) return sa - sb;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return a.version - b.version;
  });
}

export function buildPolicyRegistry(
  inputs: ReadonlyArray<SponsorGovernanceRuleInput>,
): SponsorPolicyRegistry {
  const seen = new Set<string>();
  const normalized: SponsorGovernanceRule[] = [];
  for (const input of inputs) {
    const key = `${input.scope}::${input.id}::${input.version}`;
    if (seen.has(key)) {
      throw new SponsorPolicyMutationError(`duplicate rule key: ${key}`);
    }
    seen.add(key);
    normalized.push(normalizeRule(input));
  }
  const sorted = canonicalSort(normalized);
  const byScope: Record<string, SponsorGovernanceRule[]> = {};
  for (const scope of SPONSOR_POLICY_SCOPE_ORDER) byScope[scope] = [];
  for (const r of sorted) byScope[r.scope].push(r);
  const frozenByScope: Record<string, ReadonlyArray<SponsorGovernanceRule>> = {};
  for (const scope of SPONSOR_POLICY_SCOPE_ORDER) {
    frozenByScope[scope] = Object.freeze(byScope[scope]);
  }
  const registrySignature = signObject({
    rules: sorted.map((r) => r.ruleSignature),
  });
  return deepFreeze({
    rules: Object.freeze(sorted),
    byScope: Object.freeze(frozenByScope) as Readonly<
      Record<SponsorPolicyScope, ReadonlyArray<SponsorGovernanceRule>>
    >,
    registrySignature,
  });
}

export function resolveGovernanceRules(
  registry: SponsorPolicyRegistry,
  scope: SponsorPolicyScope,
): ReadonlyArray<SponsorGovernanceRule> {
  return registry.byScope[scope] ?? Object.freeze([]);
}

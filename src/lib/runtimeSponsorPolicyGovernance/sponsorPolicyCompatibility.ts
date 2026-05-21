/**
 * Phase 1.9.23 — Sponsor Policy Compatibility Matrix.
 * Validates cross-policy compatibility deterministically.
 * Pure validation — never mutates upstream artifacts.
 */
import {
  SponsorPolicyCompatibilityError,
  deepFreeze,
  signObject,
} from './sponsorPolicyInternals';
import {
  SPONSOR_POLICY_SCOPE_ORDER,
  type SponsorGovernanceRule,
  type SponsorPolicyScope,
} from './sponsorGovernanceRules';
import type { SponsorPolicyRegistry } from './sponsorPolicyRegistry';

export interface SponsorPolicyCompatibilityCell {
  readonly scope: SponsorPolicyScope;
  readonly ruleId: string;
  readonly version: number;
  readonly compatible: true;
}

export interface SponsorPolicyCompatibilityMatrix {
  readonly cells: ReadonlyArray<SponsorPolicyCompatibilityCell>;
  readonly matrixSignature: string;
  readonly compatible: true;
}

export function validatePolicyCompatibility(
  registry: SponsorPolicyRegistry,
): SponsorPolicyCompatibilityMatrix {
  const versionByKey = new Map<string, number>();
  const cells: SponsorPolicyCompatibilityCell[] = [];
  for (const scope of SPONSOR_POLICY_SCOPE_ORDER) {
    const rules: ReadonlyArray<SponsorGovernanceRule> = registry.byScope[scope] ?? [];
    for (const r of rules) {
      const key = `${r.scope}::${r.id}`;
      const prev = versionByKey.get(key);
      if (prev !== undefined && r.version <= prev) {
        throw new SponsorPolicyCompatibilityError(
          `non-monotonic version for ${key}: ${prev} → ${r.version}`,
        );
      }
      versionByKey.set(key, r.version);
      if (r.enforcement === 'frozen' && rules.some(
        (o) => o.id === r.id && o.version > r.version,
      )) {
        throw new SponsorPolicyCompatibilityError(
          `frozen rule ${key} cannot have newer version coexisting`,
        );
      }
      cells.push(
        Object.freeze({
          scope: r.scope,
          ruleId: r.id,
          version: r.version,
          compatible: true as const,
        }),
      );
    }
  }
  const matrixSignature = signObject(
    cells.map((c) => `${c.scope}:${c.ruleId}:${c.version}`),
  );
  return deepFreeze({
    cells: Object.freeze(cells),
    matrixSignature,
    compatible: true as const,
  });
}

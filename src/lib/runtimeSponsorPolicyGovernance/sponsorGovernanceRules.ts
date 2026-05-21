/**
 * Phase 1.9.23 — Sponsor Governance Rule model.
 * Pure data structures. No behavior, no business logic.
 */
import { signObject } from './sponsorPolicyInternals';

export type SponsorPolicyScope =
  | 'mesh'
  | 'decision'
  | 'campaign'
  | 'temporal'
  | 'contract'
  | 'api'
  | 'surface'
  | 'consistency'
  | 'audit'
  | 'global';

export type SponsorPolicyEnforcementMode = 'advisory' | 'enforced' | 'frozen';

export interface SponsorGovernanceRuleInput {
  readonly id: string;
  readonly scope: SponsorPolicyScope;
  readonly version: number;
  readonly enforcement: SponsorPolicyEnforcementMode;
  readonly description: string;
  readonly value: Readonly<Record<string, unknown>>;
}

export interface SponsorGovernanceRule {
  readonly id: string;
  readonly scope: SponsorPolicyScope;
  readonly version: number;
  readonly enforcement: SponsorPolicyEnforcementMode;
  readonly description: string;
  readonly value: Readonly<Record<string, unknown>>;
  readonly ruleSignature: string;
}

export const SPONSOR_POLICY_SCOPE_ORDER: ReadonlyArray<SponsorPolicyScope> = Object.freeze([
  'mesh',
  'decision',
  'campaign',
  'temporal',
  'contract',
  'api',
  'surface',
  'consistency',
  'audit',
  'global',
]);

export function normalizeRule(input: SponsorGovernanceRuleInput): SponsorGovernanceRule {
  const ruleSignature = signObject({
    id: input.id,
    scope: input.scope,
    version: input.version,
    enforcement: input.enforcement,
    value: input.value,
  });
  return Object.freeze({
    id: input.id,
    scope: input.scope,
    version: input.version,
    enforcement: input.enforcement,
    description: input.description,
    value: Object.freeze({ ...input.value }),
    ruleSignature,
  });
}

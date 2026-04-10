/**
 * Policy Enforcement Point (PEP) v1
 *
 * Forces governance rules at runtime.
 * Intercepts SIL config, provider ranking, geo scoring, and fallback decisions.
 *
 * RULE: Governance can ALWAYS override engine output.
 */

import GovernanceEngine from '@/lib/governanceEngine';
import type { GovernanceRule } from '@/lib/governanceEngine';
import ControlRegistry from './controlRegistry';
import type { GovernableDomain } from './controlRegistry';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface PolicyOverride {
  domain: GovernableDomain;
  key: string;
  value: unknown;
  source: 'governance_rule' | 'control_plane' | 'self_healing';
  ruleId?: string;
}

export interface EnforcementResult {
  overrides: PolicyOverride[];
  applied: number;
  skipped: number;
  errors: string[];
}

// ═══════════════════════════════════════════════════════════════════════
// Enforcement Cache
// ═══════════════════════════════════════════════════════════════════════

let _lastEnforcement: EnforcementResult | null = null;
let _enforcedAt = 0;
const ENFORCE_COOLDOWN = 30_000; // 30s

// ═══════════════════════════════════════════════════════════════════════
// Core Enforcement Logic
// ═══════════════════════════════════════════════════════════════════════

function extractOverridesFromRule(rule: GovernanceRule): PolicyOverride[] {
  const overrides: PolicyOverride[] = [];
  const scope = rule.scope as GovernableDomain;
  const value = rule.value;

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      const entry = ControlRegistry.get(scope, k);
      if (entry) {
        overrides.push({
          domain: scope,
          key: k,
          value: v,
          source: 'governance_rule',
          ruleId: rule.id,
        });
      }
    }
  }

  return overrides;
}

// ═══════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════

const PolicyEnforcer = {
  /**
   * Load governance rules and enforce them onto the ControlRegistry.
   * Returns a summary of what was applied.
   */
  async enforce(): Promise<EnforcementResult> {
    const now = Date.now();
    if (_lastEnforcement && (now - _enforcedAt) < ENFORCE_COOLDOWN) {
      return _lastEnforcement;
    }

    const result: EnforcementResult = {
      overrides: [],
      applied: 0,
      skipped: 0,
      errors: [],
    };

    try {
      const allRules = await GovernanceEngine.getAllRules();

      for (const rule of allRules) {
        const overrides = extractOverridesFromRule(rule);
        for (const override of overrides) {
          const success = ControlRegistry.setValue(override.domain, override.key, override.value);
          if (success) {
            result.overrides.push(override);
            result.applied++;
          } else {
            result.skipped++;
            result.errors.push(
              `Failed to apply ${override.domain}::${override.key} = ${JSON.stringify(override.value)} (constraint violation)`
            );
          }
        }
      }
    } catch (err) {
      result.errors.push(`Enforcement error: ${err instanceof Error ? err.message : String(err)}`);
    }

    _lastEnforcement = result;
    _enforcedAt = now;
    return result;
  },

  /**
   * Apply a direct override (from Control Plane or self-healing).
   */
  applyOverride(override: PolicyOverride): boolean {
    const success = ControlRegistry.setValue(override.domain, override.key, override.value);
    if (success) {
      _lastEnforcement?.overrides.push(override);
    }
    return success;
  },

  /**
   * Get the last enforcement result.
   */
  getLastResult(): EnforcementResult | null {
    return _lastEnforcement;
  },

  /**
   * Force re-enforcement (ignores cooldown).
   */
  async forceEnforce(): Promise<EnforcementResult> {
    _lastEnforcement = null;
    _enforcedAt = 0;
    return this.enforce();
  },

  /**
   * Reset enforcement cache.
   */
  reset(): void {
    _lastEnforcement = null;
    _enforcedAt = 0;
  },
};

export default PolicyEnforcer;

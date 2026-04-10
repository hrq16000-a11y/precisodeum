/**
 * Governance Engine v1 — Core Orchestrator
 *
 * Central rule control system for the platform.
 * Answers: "Who can do what?", "What rules are active?", "Is the system coherent?"
 *
 * PRINCIPLE: Engines don't call other engines directly. They consult Governance.
 *
 * Usage:
 *   const rules = GovernanceEngine.getRules('sil');
 *   const value = GovernanceEngine.getRuleValue('sil', 'confidence_threshold');
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export type GovernanceScope = 'storage' | 'sil' | 'geo' | 'ui' | 'auth' | 'ranking' | 'global';

export interface GovernanceRule {
  id: string;
  scope: GovernanceScope;
  key: string;
  value: Record<string, unknown>;
  status: 'active' | 'deprecated' | 'testing';
  version: number;
  description: string;
}

interface RuleCache {
  rules: GovernanceRule[];
  fetchedAt: number;
}

// ═══════════════════════════════════════════════════════════════════════
// Singleton
// ═══════════════════════════════════════════════════════════════════════

const CACHE_TTL = 60_000; // 1 minute
let _cache: RuleCache | null = null;
let _fetchPromise: Promise<GovernanceRule[]> | null = null;

async function fetchRules(): Promise<GovernanceRule[]> {
  const { data, error } = await supabase
    .from('governance_rules' as any)
    .select('*')
    .eq('status', 'active')
    .order('scope');

  if (error) {
    console.error('[GovernanceEngine] Failed to fetch rules:', error.message);
    return _cache?.rules ?? [];
  }

  const rules = (data || []) as unknown as GovernanceRule[];
  _cache = { rules, fetchedAt: Date.now() };
  _fetchPromise = null;
  return rules;
}

function isCacheValid(): boolean {
  return !!_cache && (Date.now() - _cache.fetchedAt) < CACHE_TTL;
}

// ═══════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════

const GovernanceEngine = {
  /**
   * Get all active rules for a given scope.
   */
  async getRules(scope: GovernanceScope): Promise<GovernanceRule[]> {
    const all = await this.getAllRules();
    return all.filter(r => r.scope === scope);
  },

  /**
   * Get a specific rule value by scope+key.
   * Returns the JSONB value or the defaultValue if not found.
   */
  async getRuleValue<T = unknown>(
    scope: GovernanceScope,
    key: string,
    defaultValue?: T
  ): Promise<T> {
    const rules = await this.getRules(scope);
    const rule = rules.find(r => r.key === key);
    return (rule?.value as T) ?? (defaultValue as T);
  },

  /**
   * Get all cached/fetched rules.
   */
  async getAllRules(): Promise<GovernanceRule[]> {
    if (isCacheValid()) return _cache!.rules;
    if (_fetchPromise) return _fetchPromise;
    _fetchPromise = fetchRules();
    return _fetchPromise;
  },

  /**
   * Force cache invalidation.
   */
  invalidate() {
    _cache = null;
    _fetchPromise = null;
  },

  /**
   * Log a governance change (for client-side rule updates).
   */
  async logChange(ruleId: string, action: 'create' | 'update' | 'delete', before?: unknown, after?: unknown) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase.from('governance_changes_log' as any) as any).insert({
      rule_id: ruleId,
      action,
      before_value: before ?? null,
      after_value: after ?? null,
      user_id: user.id,
    });
  },

  /**
   * Request approval for a rule change.
   */
  async requestApproval(ruleId: string, proposedValue: Record<string, unknown>, reason: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase.from('governance_approvals' as any) as any).insert({
      rule_id: ruleId,
      requested_by: user.id,
      status: 'pending',
      proposed_value: proposedValue,
      reason,
    });
  },
};

export default GovernanceEngine;

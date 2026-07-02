/**
 * Control Plane Core v2 — Central Decision Authority
 *
 * Architecture:
 *   User Query → SIL → ControlPlane.evaluate()
 *     → Governance override check
 *     → GeoEngine validation
 *     → Policy enforcement
 *     → Final ranked output
 *
 * Decision Priority:
 *   1. Governance Rules (highest)
 *   2. Control Plane overrides
 *   3. SIL output
 *   4. GeoEngine output
 *   5. Local fallback logic (lowest)
 *
 * PRINCIPLE: All engine outputs pass through the Control Plane before final use.
 */

import GovernanceEngine from '@/lib/governanceEngine';
import type { GovernanceScope } from '@/lib/governanceEngine';
import ControlRegistry from './controlRegistry';
import type { GovernableDomain } from './controlRegistry';
import PolicyEnforcer from './policyEnforcer';
import SelfHealingLoop from './selfHealingLoop';
import type { HealingCycleResult } from './selfHealingLoop';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface EvaluationContext {
  source: 'sil' | 'geo' | 'ranking' | 'runtime' | 'ui';
  action: string;
  inputs: Record<string, unknown>;
}

export interface EvaluationResult {
  allowed: boolean;
  outputs: Record<string, unknown>;
  overridesApplied: string[];
  resolvedConflicts: ConflictResolution[];
  timestamp: number;
}

export interface ConflictResolution {
  field: string;
  sources: { source: string; value: unknown }[];
  winner: string;
  resolvedValue: unknown;
  reason: string;
}

export type EngineHook = (context: EvaluationContext) => Record<string, unknown> | null;

interface SystemState {
  registrySnapshot: Record<string, unknown>;
  lastEnforcement: unknown;
  lastHealingCycle: HealingCycleResult | null;
  engineHooks: string[];
  uptime: number;
}

// ═══════════════════════════════════════════════════════════════════════
// Internal State
// ═══════════════════════════════════════════════════════════════════════

const _hooks = new Map<string, EngineHook>();
const _startTime = Date.now();
let _initialized = false;
let _initPromise: Promise<void> | null = null;

// ═══════════════════════════════════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════════════════════════════════

async function initialize(): Promise<void> {
  if (_initialized) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      // 1. Enforce governance rules onto the registry
      await PolicyEnforcer.enforce();
      _initialized = true;
    } catch (err) {
      console.warn('[ControlPlane] Init fallback — governance unavailable:', err);
      _initialized = true; // Continue with defaults
    } finally {
      _initPromise = null;
    }
  })();

  return _initPromise;
}

// Fire-and-forget init
initialize();

// ═══════════════════════════════════════════════════════════════════════
// Conflict Resolution
// ═══════════════════════════════════════════════════════════════════════

/**
 * Priority: governance > controlPlane > sil > geo > fallback
 */
function resolveConflicts(
  field: string,
  sources: { source: string; value: unknown }[]
): ConflictResolution {
  const PRIORITY: Record<string, number> = {
    governance: 1,
    control_plane: 2,
    sil: 3,
    geo: 4,
    fallback: 5,
  };

  const sorted = [...sources].sort(
    (a, b) => (PRIORITY[a.source] ?? 99) - (PRIORITY[b.source] ?? 99)
  );

  const winner = sorted[0];

  return {
    field,
    sources,
    winner: winner.source,
    resolvedValue: winner.value,
    reason: sources.length === 1
      ? 'single source'
      : `resolved by priority (${winner.source} > ${sorted.slice(1).map(s => s.source).join(', ')})`,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════

const ControlPlane = {
  /**
   * Main evaluation entry point.
   * Every engine output passes through here for governance validation.
   */
  async evaluate(context: EvaluationContext): Promise<EvaluationResult> {
    await initialize();

    const overridesApplied: string[] = [];
    const resolvedConflicts: ConflictResolution[] = [];
    const outputs: Record<string, unknown> = { ...context.inputs };

    // 1. Governance override check — load any rules for this scope
    const domain = context.source as GovernableDomain;
    const domainEntries = ControlRegistry.getByDomain(domain);

    for (const entry of domainEntries) {
      const inputVal = context.inputs[entry.key];
      if (inputVal !== undefined && inputVal !== entry.currentValue) {
        // Conflict: engine wants X, governance says Y
        const resolution = resolveConflicts(entry.key, [
          { source: 'governance', value: entry.currentValue },
          { source: context.source, value: inputVal },
        ]);

        outputs[entry.key] = resolution.resolvedValue;
        resolvedConflicts.push(resolution);

        if (resolution.winner === 'governance') {
          overridesApplied.push(`${entry.key}: ${JSON.stringify(inputVal)} → ${JSON.stringify(entry.currentValue)}`);
        }
      }
    }

    // 2. Apply engine hooks
    for (const [name, hook] of _hooks.entries()) {
      try {
        const hookResult = hook(context);
        if (hookResult) {
          for (const [k, v] of Object.entries(hookResult)) {
            if (outputs[k] === undefined) {
              outputs[k] = v;
            }
          }
        }
      } catch (err) {
        console.warn(`[ControlPlane] Hook "${name}" error:`, err);
      }
    }

    return {
      allowed: true,
      outputs,
      overridesApplied,
      resolvedConflicts,
      timestamp: Date.now(),
    };
  },

  /**
   * Register an engine hook.
   */
  registerHook(engineName: string, hook: EngineHook): void {
    _hooks.set(engineName, hook);
  },

  /**
   * Unregister an engine hook.
   */
  unregisterHook(engineName: string): void {
    _hooks.delete(engineName);
  },

  /**
   * Apply a governance policy to the system.
   * Forces re-enforcement of all rules.
   */
  async applyPolicy(scope: GovernanceScope, overrides: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(overrides)) {
      ControlRegistry.setValue(scope as GovernableDomain, key, value);
    }
    await PolicyEnforcer.forceEnforce();
  },

  /**
   * Trigger a self-healing cycle.
   */
  async selfHeal(): Promise<HealingCycleResult> {
    return SelfHealingLoop.runCycle();
  },

  /**
   * Get full system state for diagnostics.
   */
  getSystemState(): SystemState {
    return {
      registrySnapshot: ControlRegistry.snapshot(),
      lastEnforcement: PolicyEnforcer.getLastResult(),
      lastHealingCycle: SelfHealingLoop.getLastCycle(),
      engineHooks: Array.from(_hooks.keys()),
      uptime: Date.now() - _startTime,
    };
  },

  /**
   * Get a governed value for any domain/key.
   * Convenience wrapper over ControlRegistry.
   */
  getValue<T = unknown>(domain: GovernableDomain, key: string): T | undefined {
    return ControlRegistry.getValue<T>(domain, key);
  },

  /**
   * Force full re-initialization.
   */
  async reinitialize(): Promise<void> {
    _initialized = false;
    GovernanceEngine.invalidate();
    PolicyEnforcer.reset();
    ControlRegistry.resetAll();
    await initialize();
  },
};

export default ControlPlane;

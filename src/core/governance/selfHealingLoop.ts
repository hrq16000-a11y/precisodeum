/**
 * Self-Healing Loop v1
 *
 * Closed-loop auto-adjustment system.
 * Flow: drift detection → rule generation → apply → re-evaluate → stabilize
 *
 * Uses SystemIntegrityEngine for drift detection and GovernanceEngine for rule injection.
 */

import SystemIntegrityEngine from '@/lib/systemIntegrityEngine';
import type { DriftReport } from '@/lib/systemIntegrityEngine';
import RuntimeStabilityEngine from '@/lib/runtimeStabilityEngine';
import type { ComponentHealth } from '@/lib/runtimeStabilityEngine';
import GovernanceEngine from '@/lib/governanceEngine';
import PolicyEnforcer from './policyEnforcer';
import ControlRegistry from './controlRegistry';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface HealingAction {
  trigger: 'drift' | 'runtime_failure' | 'performance_degradation';
  source: string;
  action: string;
  domain: string;
  key: string;
  previousValue: unknown;
  newValue: unknown;
  timestamp: number;
}

export interface HealingCycleResult {
  cycleId: string;
  startedAt: number;
  completedAt: number;
  driftsDetected: number;
  failingComponents: number;
  actionsApplied: HealingAction[];
  stabilized: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// Healing History
// ═══════════════════════════════════════════════════════════════════════

const _healingHistory: HealingCycleResult[] = [];
const MAX_HISTORY = 50;

// ═══════════════════════════════════════════════════════════════════════
// Healing Strategies
// ═══════════════════════════════════════════════════════════════════════

function healFromDrifts(drifts: DriftReport[]): HealingAction[] {
  const actions: HealingAction[] = [];

  for (const drift of drifts) {
    // Engine drift → tighten confidence threshold
    if (drift.type === 'engine' && drift.severity === 'critical') {
      const current = ControlRegistry.getValue<number>('sil', 'confidenceThreshold') ?? 0.4;
      const newVal = Math.min(current + 0.1, 0.9);
      actions.push({
        trigger: 'drift',
        source: drift.description,
        action: 'increase_confidence_threshold',
        domain: 'sil',
        key: 'confidenceThreshold',
        previousValue: current,
        newValue: newVal,
        timestamp: Date.now(),
      });
    }

    // Policy drift → disable risky features
    if (drift.type === 'policy' && drift.severity === 'high') {
      actions.push({
        trigger: 'drift',
        source: drift.description,
        action: 'disable_hybrid_boost',
        domain: 'sil',
        key: 'enableHybridBoost',
        previousValue: true,
        newValue: false,
        timestamp: Date.now(),
      });
    }
  }

  return actions;
}

function healFromRuntimeFailures(failing: ComponentHealth[]): HealingAction[] {
  const actions: HealingAction[] = [];

  if (failing.length >= 3) {
    // Multiple components failing → increase retry limit
    const current = ControlRegistry.getValue<number>('runtime', 'maxRetries') ?? 3;
    if (current < 5) {
      actions.push({
        trigger: 'runtime_failure',
        source: `${failing.length} components failing`,
        action: 'increase_max_retries',
        domain: 'runtime',
        key: 'maxRetries',
        previousValue: current,
        newValue: current + 1,
        timestamp: Date.now(),
      });
    }
  }

  return actions;
}

// ═══════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════

const SelfHealingLoop = {
  /**
   * Run a full healing cycle:
   * 1. Detect drifts
   * 2. Check runtime health
   * 3. Generate healing actions
   * 4. Apply via PolicyEnforcer
   * 5. Re-evaluate stability
   */
  async runCycle(): Promise<HealingCycleResult> {
    const cycleId = `heal_${Date.now()}`;
    const startedAt = Date.now();
    const actionsApplied: HealingAction[] = [];

    // 1. Detect drifts
    let drifts: DriftReport[] = [];
    try {
      drifts = await SystemIntegrityEngine.getUnresolvedDrifts();
    } catch {
      // Integrity engine unavailable — continue
    }

    // 2. Check runtime health
    let failing: ComponentHealth[] = [];
    try {
      failing = await RuntimeStabilityEngine.getFailingComponents();
    } catch {
      // Runtime engine unavailable — continue
    }

    // 3. Generate actions
    const driftActions = healFromDrifts(drifts);
    const runtimeActions = healFromRuntimeFailures(failing);
    const allActions = [...driftActions, ...runtimeActions];

    // 4. Apply actions
    for (const action of allActions) {
      const success = PolicyEnforcer.applyOverride({
        domain: action.domain as any,
        key: action.key,
        value: action.newValue,
        source: 'self_healing',
      });
      if (success) {
        actionsApplied.push(action);
      }
    }

    // 5. Re-enforce all policies
    if (actionsApplied.length > 0) {
      await PolicyEnforcer.forceEnforce();
    }

    const result: HealingCycleResult = {
      cycleId,
      startedAt,
      completedAt: Date.now(),
      driftsDetected: drifts.length,
      failingComponents: failing.length,
      actionsApplied,
      stabilized: actionsApplied.length === 0 || failing.length === 0,
    };

    // Store in history
    _healingHistory.unshift(result);
    if (_healingHistory.length > MAX_HISTORY) {
      _healingHistory.pop();
    }

    if (actionsApplied.length > 0) {
      console.info(`[SelfHealing] Cycle ${cycleId}: applied ${actionsApplied.length} actions`);
    }

    return result;
  },

  /**
   * Get healing history.
   */
  getHistory(): ReadonlyArray<HealingCycleResult> {
    return _healingHistory;
  },

  /**
   * Get the last cycle result.
   */
  getLastCycle(): HealingCycleResult | null {
    return _healingHistory[0] ?? null;
  },

  /**
   * Clear history.
   */
  clearHistory(): void {
    _healingHistory.length = 0;
  },
};

export default SelfHealingLoop;

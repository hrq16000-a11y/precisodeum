/**
 * Governance Core — Barrel Export
 *
 * Usage:
 *   import { ControlPlane, PolicyEnforcer, ControlRegistry, SelfHealingLoop } from '@/core/governance';
 */

export { default as ControlPlane } from './controlPlane';
export { default as PolicyEnforcer } from './policyEnforcer';
export { default as ControlRegistry } from './controlRegistry';
export { default as SelfHealingLoop } from './selfHealingLoop';

// Re-export types
export type { EvaluationContext, EvaluationResult, ConflictResolution, EngineHook } from './controlPlane';
export type { PolicyOverride, EnforcementResult } from './policyEnforcer';
export type { GovernableDomain, GovernableType, GovernableEntry } from './controlRegistry';
export type { HealingAction, HealingCycleResult } from './selfHealingLoop';

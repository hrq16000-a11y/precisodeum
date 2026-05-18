/**
 * Fase 1.7.7 — Execution parity engine (READ-ONLY).
 *
 * Compara estruturalmente plano legacy vs atomic e produz score determinístico.
 */

import { OPERATION_REGISTRY, type FlowId } from '@/lib/operations/operationRegistry';
import { simulateFlow } from './simulateAtomicExecution';
import { compareConsistency } from './consistencyComparator';
import type { ParityResult } from './simulationTypes';

function listsMatch(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function compareLegacyVsAtomic(flow: FlowId): ParityResult | null {
  const sim = simulateFlow(flow);
  if (!sim) return null;
  const legacySteps = sim.legacy.steps.map((s) => s.step);
  const atomicSteps = sim.atomic.steps.map((s) => s.step);
  const orderParity = listsMatch(legacySteps, atomicSteps);

  // resultParity: ambos terminam em estado público no último passo
  const lastLegacy = sim.legacy.steps[sim.legacy.steps.length - 1];
  const lastAtomic = sim.atomic.steps[sim.atomic.steps.length - 1];
  const resultParity = !!lastLegacy && !!lastAtomic && lastLegacy.step === lastAtomic.step;

  // sideEffectParity: legacy expõe visibilidade parcial, atomic não — só conta
  // como paridade se não houver visibilidade parcial em legacy.
  const sideEffectParity = !sim.legacy.steps.some((s) => s.visibility === 'partial');

  // rollbackParity: estratégias iguais
  const rollbackParity = sim.legacy.rollback === sim.atomic.rollback;

  // visibilityParity: ambos têm o mesmo terminal de visibilidade
  const visibilityParity =
    !!lastLegacy && !!lastAtomic && lastLegacy.visibility === lastAtomic.visibility;

  // consistencyParity: shared completo
  const cmp = compareConsistency(flow);
  const consistencyParity = !!cmp && cmp.matches;

  const checks = [
    orderParity,
    resultParity,
    sideEffectParity,
    rollbackParity,
    visibilityParity,
    consistencyParity,
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  const regressions: string[] = [];
  if (!orderParity) regressions.push('order_diverged');
  if (!resultParity) regressions.push('result_diverged');
  if (!sideEffectParity) regressions.push('partial_visibility_in_legacy');
  if (!rollbackParity) regressions.push('rollback_strategy_mismatch');
  if (!visibilityParity) regressions.push('terminal_visibility_mismatch');
  if (!consistencyParity) regressions.push('consistency_levels_diverged');

  return {
    flow,
    orderParity,
    resultParity,
    sideEffectParity,
    rollbackParity,
    visibilityParity,
    consistencyParity,
    score,
    regressions,
  };
}

export function calculateExecutionParity(): Record<FlowId, ParityResult> {
  const out = {} as Record<FlowId, ParityResult>;
  for (const r of OPERATION_REGISTRY) {
    const p = compareLegacyVsAtomic(r.flow);
    if (p) out[r.flow] = p;
  }
  return out;
}

export function detectParityRegression(prev: ParityResult, curr: ParityResult): string[] {
  const regressions: string[] = [];
  if (curr.score < prev.score) regressions.push('score_dropped');
  for (const r of curr.regressions) {
    if (!prev.regressions.includes(r)) regressions.push(`new:${r}`);
  }
  return regressions;
}

export function explainParityGap(p: ParityResult): string {
  if (p.regressions.length === 0) return `flow=${p.flow} parity=full score=${p.score}`;
  return `flow=${p.flow} score=${p.score} gaps=${p.regressions.join(',')}`;
}

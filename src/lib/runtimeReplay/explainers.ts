/**
 * Fase 1.8.2 — Replay explainers (READ-ONLY).
 */

import type {
  ReplayClassification,
  ReplayDeterminism,
  ReplayParity,
  ReplayPropagation,
  ReplayRisk,
  RuntimeReplay,
} from './replayTypes';

export function explainReplayClassification(c: ReplayClassification): string {
  switch (c) {
    case 'deterministic':
      return 'Replay determinístico: ordering estável, parity alta, sem drift crítico.';
    case 'partially_deterministic':
      return 'Replay parcialmente determinístico: eventual consistency aceitável dentro do esperado.';
    case 'unstable':
      return 'Replay instável: ordering observado varia entre amostras.';
    case 'divergent':
      return 'Replay divergente: parity/ordering incompatíveis com simulation.';
    case 'unreconstructable':
      return 'Replay irreconstruível: lineage quebrada ou dependências ausentes.';
  }
}

export function explainReplayRisk(r: ReplayRisk): string {
  switch (r) {
    case 'none': return 'Risco nulo: replay alinhado a simulation e governance.';
    case 'low': return 'Risco baixo: replay com tolerância eventual.';
    case 'medium': return 'Risco médio: instabilidade ou parity gap moderado.';
    case 'high': return 'Risco alto: divergência ou drift severo.';
    case 'critical': return 'Risco crítico: replay irreconstruível, orphan ou ciclo de propagação.';
  }
}

export function explainReplayPropagation(p: ReplayPropagation): string {
  switch (p) {
    case 'isolated': return 'Propagação isolada: falhas não escaparam do step.';
    case 'contained': return 'Propagação contida: falhas no boundary, sem cascata.';
    case 'cascading': return 'Propagação em cascata: orphans/mirrors afetados.';
    case 'recursive': return 'Propagação recursiva: step depende de si mesmo.';
    case 'circular': return 'Propagação circular: ciclo detectado entre steps.';
  }
}

export function explainReplayParity(p: ReplayParity): string {
  const parts = [
    `score=${p.score}`,
    `gap=${p.gap}`,
    p.regression ? 'regression=on' : 'regression=off',
    p.rollbackMismatch ? 'rollback=mismatch' : 'rollback=ok',
    p.visibilityGap ? 'visibility=gap' : 'visibility=ok',
  ];
  return `Replay parity ${parts.join(' · ')}.`;
}

export function explainReplayDeterminism(d: ReplayDeterminism): string {
  return `Determinismo ${d.classification}: ordering ${d.orderingStable ? 'stable' : 'unstable'} / outcome ${d.outcomeStable ? 'stable' : 'unstable'} (conf=${d.confidence}/${d.confidenceScore}).`;
}

export function explainRuntimeReplay(r: RuntimeReplay): string {
  return [
    explainReplayClassification(r.classification),
    explainReplayRisk(r.risk),
    explainReplayDeterminism(r.determinism),
    explainReplayParity(r.parity),
    explainReplayPropagation(r.propagation.propagation),
  ].join(' ');
}

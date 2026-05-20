/**
 * Fase 1.8.3 — Causality explainers (READ-ONLY, strings puras PT-BR).
 */

import type {
  CausalityClassification,
  CausalityStrength,
  FailureOrigin,
  PropagationMode,
  RuntimeCausalityGraph,
} from './causalityTypes';

export function explainCausalityClassification(c: CausalityClassification): string {
  switch (c) {
    case 'isolated': return 'Causalidade isolada — flow sem dependências relevantes.';
    case 'dependent': return 'Causalidade dependente — flow possui dependências diretas.';
    case 'cascading': return 'Causalidade em cascata — falhas/inconsistências se propagam.';
    case 'recursive': return 'Causalidade recursiva — um step depende de si mesmo.';
    case 'circular': return 'Causalidade circular — ciclo entre steps detectado.';
    case 'hidden': return 'Causalidade oculta — dependência fora do registry observada.';
  }
}

export function explainFailureOrigin(o: FailureOrigin): string {
  switch (o) {
    case 'owner_missing': return 'Origem: owner ausente.';
    case 'mirror_desync': return 'Origem: dessincronização de mirror.';
    case 'finalize_gap': return 'Origem: finalize não confirmado.';
    case 'ordering_violation': return 'Origem: violação de ordem.';
    case 'replay_divergence': return 'Origem: replay divergente.';
    case 'parity_gap': return 'Origem: gap de paridade.';
    case 'stale_projection': return 'Origem: projeção desatualizada.';
    case 'hidden_dependency': return 'Origem: dependência oculta.';
    case 'drift_escalation': return 'Origem: escalada de drift.';
    case 'orphan_state': return 'Origem: estado órfão.';
  }
}

export function explainPropagationMode(m: PropagationMode): string {
  switch (m) {
    case 'direct': return 'Propagação direta.';
    case 'indirect': return 'Propagação indireta.';
    case 'delayed': return 'Propagação atrasada.';
    case 'eventual': return 'Propagação eventual.';
    case 'recursive': return 'Propagação recursiva.';
    case 'circular': return 'Propagação circular.';
  }
}

export function explainCausalityStrength(s: CausalityStrength): string {
  switch (s) {
    case 'none': return 'Sem causalidade observável.';
    case 'weak': return 'Causalidade fraca.';
    case 'moderate': return 'Causalidade moderada.';
    case 'strong': return 'Causalidade forte.';
    case 'critical': return 'Causalidade crítica.';
  }
}

export function explainPropagationDepth(depth: number): string {
  if (depth <= 0) return 'Profundidade de propagação nula.';
  if (depth === 1) return 'Profundidade de propagação direta (1).';
  return `Profundidade de propagação ${depth}.`;
}

export function explainRuntimeCausality(g: RuntimeCausalityGraph): string {
  return [
    `Flow ${g.flow}:`,
    explainCausalityClassification(g.classification),
    explainCausalityStrength(g.strength),
    explainPropagationMode(g.propagation.mode),
    explainPropagationDepth(g.propagation.depth),
    `Severidade: ${g.severity}.`,
  ].join(' ');
}

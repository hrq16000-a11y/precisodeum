/**
 * Fase 1.8.4 — Stability explainers (READ-ONLY, pure strings).
 */

import type {
  CollapseSeverity,
  ConvergenceMode,
  DependencyResolution,
  PropagationEnvelopeKind,
  StabilityClassification,
} from './stabilityTypes';

export function explainStabilityClassification(c: StabilityClassification): string {
  switch (c) {
    case 'stable': return 'Envelope estável: dependências resolvidas e convergência determinística.';
    case 'converging': return 'Envelope em convergência: estabilizando ao longo do tempo.';
    case 'unstable': return 'Envelope instável: dependências parciais ou propagação irregular.';
    case 'collapsing': return 'Envelope em colapso: pontos críticos detectados.';
    case 'divergent': return 'Envelope divergente: convergência impossível com dados atuais.';
  }
}

export function explainDependencyResolution(r: DependencyResolution): string {
  switch (r) {
    case 'resolved': return 'Todas as dependências foram resolvidas.';
    case 'partially_resolved': return 'Resolução parcial: parte das dependências segue pendente.';
    case 'unresolved': return 'Dependências não resolvidas detectadas.';
    case 'hidden': return 'Dependências ocultas presentes — risco de cascata invisível.';
    case 'circular': return 'Dependência circular detectada — propagação inviável.';
  }
}

export function explainCollapseSeverity(s: CollapseSeverity): string {
  switch (s) {
    case 'none': return 'Sem risco de colapso.';
    case 'low': return 'Risco baixo de colapso isolado.';
    case 'medium': return 'Risco moderado de colapso parcial.';
    case 'high': return 'Risco alto: colapso pode propagar.';
    case 'critical': return 'Risco crítico: colapso em cascata iminente.';
  }
}

export function explainConvergenceMode(m: ConvergenceMode): string {
  switch (m) {
    case 'deterministic': return 'Convergência imediata e determinística.';
    case 'eventual': return 'Convergência eventual dentro de janela aceitável.';
    case 'delayed': return 'Convergência atrasada — monitorar.';
    case 'recursive': return 'Convergência recursiva — risco de loop.';
    case 'divergent': return 'Sem convergência detectada.';
  }
}

export function explainPropagationEnvelope(k: PropagationEnvelopeKind): string {
  switch (k) {
    case 'owner': return 'Envelope do owner do fluxo.';
    case 'mirrors': return 'Envelope dos mirrors espelhados.';
    case 'finalize': return 'Envelope da fase de finalização.';
    case 'onboarding': return 'Envelope dos passos de onboarding.';
    case 'progress': return 'Envelope do progresso observado.';
    case 'avatar': return 'Envelope da sincronização de avatar.';
    case 'admin': return 'Envelope das ações administrativas.';
    case 'replay': return 'Envelope de replay reconstruído.';
    case 'eventual_sync': return 'Envelope de sincronização eventual.';
  }
}

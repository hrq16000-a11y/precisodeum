/**
 * Onboarding Auto-Response Engine · funções puras
 *
 * Este módulo é a **fonte única** das regras de mitigation. Tudo aqui é
 * deterministico, sem efeitos colaterais, sem rede — para que seja testável
 * em isolamento e espelhável em SQL.
 *
 * O motor servidor (RPC `evaluate_onboarding_auto_response`) implementa a
 * mesma máquina de estado em PL/pgSQL. Mantenha as duas em sincronia.
 */

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentState =
  | 'normal'
  | 'degraded'
  | 'incident'
  | 'recovery'
  | 'resolved';

export interface RegressionSignal {
  metric: string;
  severity?: IncidentSeverity | string | null;
  current_value?: number | null;
  baseline_value?: number | null;
  threshold_value?: number | null;
  app_version?: string | null;
  release_channel?: string | null;
  detected_at: Date;
}

export interface ExistingIncident {
  id: string;
  trigger_metric: string;
  opened_at: Date;
  resolved_at: Date | null;
}

export interface MitigationAction {
  /** Flag em `site_settings` a ser alterada (descritivo; consumo é opt-in). */
  flag: string;
  /** Valor alvo da flag. */
  to: boolean;
  /** Motivo legível. */
  reason: string;
}

export interface OpenIncidentDecision {
  kind: 'open';
  metric: string;
  severity: IncidentSeverity;
  state: IncidentState;
  actions: MitigationAction[];
  app_version: string | null;
  release_channel: string | null;
  trigger_value: number | null;
  baseline_value: number | null;
  threshold_value: number | null;
}

export interface SkipDecision {
  kind: 'skip';
  metric: string;
  reason: 'disabled' | 'debounced' | 'duplicate_metric';
}

export type Decision = OpenIncidentDecision | SkipDecision;

/** Janela padrão para debounce de mesma métrica (minutos). */
export const DEFAULT_DEBOUNCE_MINUTES = 30;
/** Auto-resolve quando incidente fica sem nova regressão por X minutos. */
export const DEFAULT_AUTO_RESOLVE_MINUTES = 60;

const VALID_SEVERITIES: IncidentSeverity[] = ['low', 'medium', 'high', 'critical'];

export function normalizeSeverity(value: unknown): IncidentSeverity {
  if (typeof value === 'string' && (VALID_SEVERITIES as string[]).includes(value)) {
    return value as IncidentSeverity;
  }
  return 'medium';
}

/**
 * Decide quais ações automáticas tomar para uma métrica em regressão.
 * Mantém paridade com a função SQL `evaluate_onboarding_auto_response`.
 */
export function deriveActions(metric: string, severity: IncidentSeverity): MitigationAction[] {
  const m = metric.toLowerCase();
  if (m.includes('autosave') && m.includes('fail')) {
    return [{ flag: 'onboarding_remote_draft_enabled', to: false, reason: 'autosave_remote_collapse' }];
  }
  if (m.startsWith('recovery_corrupt') || m.startsWith('recovery_failed')) {
    return [{ flag: 'onboarding_remote_recovery_enabled', to: false, reason: 'recovery_corruption' }];
  }
  if (m.startsWith('refresh')) {
    return [{ flag: 'onboarding_local_autosave_boost', to: true, reason: 'refresh_spike' }];
  }
  if (m.startsWith('completion') && (severity === 'high' || severity === 'critical')) {
    return [{ flag: 'onboarding_recovery_modal_enabled', to: true, reason: 'completion_collapse' }];
  }
  return [];
}

/**
 * Estado operacional a abrir, dada a severidade da regressão.
 * critical/high → incident · low/medium → degraded.
 */
export function stateForSeverity(severity: IncidentSeverity): IncidentState {
  return severity === 'high' || severity === 'critical' ? 'incident' : 'degraded';
}

/**
 * Avalia um sinal de regressão contra o conjunto de incidentes existentes
 * e decide se abre um novo incidente ou se deve ser ignorado.
 *
 * Regras:
 *  1. Se o motor estiver desligado → `skip:disabled` (circuit breaker global).
 *  2. Se já existe incidente OPEN para a mesma métrica em < debounce → `skip:debounced`.
 *  3. Caso contrário → `open` com ações derivadas.
 */
export function evaluateSignal(
  signal: RegressionSignal,
  existing: ExistingIncident[],
  options: {
    enabled: boolean;
    now: Date;
    debounceMinutes?: number;
  },
): Decision {
  if (!options.enabled) {
    return { kind: 'skip', metric: signal.metric, reason: 'disabled' };
  }

  const debounceMs = (options.debounceMinutes ?? DEFAULT_DEBOUNCE_MINUTES) * 60_000;
  const cutoff = options.now.getTime() - debounceMs;

  const hasRecent = existing.some(
    (i) => i.trigger_metric === signal.metric && i.opened_at.getTime() >= cutoff,
  );
  if (hasRecent) {
    return { kind: 'skip', metric: signal.metric, reason: 'debounced' };
  }

  const severity = normalizeSeverity(signal.severity);
  return {
    kind: 'open',
    metric: signal.metric,
    severity,
    state: stateForSeverity(severity),
    actions: deriveActions(signal.metric, severity),
    app_version: signal.app_version ?? null,
    release_channel: signal.release_channel ?? null,
    trigger_value: signal.current_value ?? null,
    baseline_value: signal.baseline_value ?? null,
    threshold_value: signal.threshold_value ?? null,
  };
}

/**
 * Avalia uma lista de sinais em ordem cronológica e desduplica por métrica
 * **dentro do mesmo batch** (a primeira ocorrência vence; demais → duplicate).
 */
export function evaluateBatch(
  signals: RegressionSignal[],
  existing: ExistingIncident[],
  options: { enabled: boolean; now: Date; debounceMinutes?: number },
): Decision[] {
  const seen = new Set<string>();
  const out: Decision[] = [];
  // existing é mutado em memória só para o cálculo local (não persiste)
  const local: ExistingIncident[] = [...existing];

  for (const signal of signals) {
    if (seen.has(signal.metric)) {
      out.push({ kind: 'skip', metric: signal.metric, reason: 'duplicate_metric' });
      continue;
    }
    const d = evaluateSignal(signal, local, options);
    out.push(d);
    if (d.kind === 'open') {
      seen.add(signal.metric);
      local.push({
        id: 'pending',
        trigger_metric: signal.metric,
        opened_at: options.now,
        resolved_at: null,
      });
    }
  }
  return out;
}

/**
 * Verifica se um incidente aberto deve ser auto-resolvido.
 * Critério: não houve nova regressão da mesma métrica dentro da janela
 * `autoResolveMinutes` E o incidente já está aberto há pelo menos a mesma janela.
 */
export function shouldAutoResolve(
  incident: ExistingIncident,
  recentMetrics: { metric: string; at: Date }[],
  options: { now: Date; autoResolveMinutes?: number },
): boolean {
  if (incident.resolved_at) return false;
  const windowMs = (options.autoResolveMinutes ?? DEFAULT_AUTO_RESOLVE_MINUTES) * 60_000;
  const ageMs = options.now.getTime() - incident.opened_at.getTime();
  if (ageMs < windowMs) return false;

  const cutoff = options.now.getTime() - windowMs;
  const hasRecent = recentMetrics.some(
    (r) => r.metric === incident.trigger_metric && r.at.getTime() >= cutoff,
  );
  return !hasRecent;
}

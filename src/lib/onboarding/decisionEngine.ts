/**
 * Onboarding Decision Intelligence System (PURE / DETERMINISTIC).
 *
 * Lê snapshots já agregados (funil, releases, regressões, experimentos,
 * behavioral, incidents) e emite diagnósticos operacionais acionáveis.
 *
 * REGRAS DURAS:
 *  - Sem IA generativa.
 *  - Sem chamadas de rede / DB / hooks.
 *  - Sem mutação dos inputs.
 *  - Sem efeitos colaterais (não dispara nada).
 *  - Apenas interpretação determinística + templates fixos.
 *
 * Output: Diagnostic[] já priorizado, com confidence, severity, causa
 * provável, ações sugeridas e cadeia causal (quando aplicável).
 */

// ---------- Tipos de entrada ----------

export interface FunnelPhaseSignal {
  phase: string;
  enters: number;
  exits: number;
  completes: number;
  abandons: number;
  refreshes: number;
  recoveries: number;
  validation_failed: number;
  autosave_failed: number;
  regressions: number;
  unique_sessions: number;
  unique_users: number;
  /** Tempo médio na fase em segundos (opcional). */
  avg_duration_s?: number;
  /** Mediana do tempo, se disponível. */
  median_duration_s?: number;
}

export interface ReleaseSignal {
  app_version: string;
  release_channel: string;
  unique_sessions: number;
  completes: number;
  abandons: number;
  validation_failures: number;
  autosave_failures: number;
  /** Completion rate 0..1 calculado pelo caller. */
  completion_rate: number;
}

export interface RegressionSignal {
  metric: string;
  phase?: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  delta_pct?: number;
  detected_at: string;
  app_version?: string | null;
}

export interface ExperimentSignal {
  key: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'auto_disabled';
  variant_count: number;
  /** Queda relativa de completion vs controle, em pp. */
  completion_drop_pp?: number;
  /** Aumento relativo de validation failure vs controle, em %. */
  validation_increase_pct?: number;
  affected_phase?: string | null;
}

export interface BehavioralSignal {
  phase: string;
  rage_clicks: number;
  hesitations: number;
  repeated_validation_errors: number;
  /** Campos problemáticos detectados. */
  problematic_fields?: string[];
  /** Segmentação opcional: 'mobile' | 'desktop' | undefined. */
  device?: string;
}

export interface IncidentSignal {
  id: string;
  status: 'open' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  opened_at: string;
}

export interface DecisionInput {
  funnel: ReadonlyArray<FunnelPhaseSignal>;
  releases?: ReadonlyArray<ReleaseSignal>;
  regressions?: ReadonlyArray<RegressionSignal>;
  experiments?: ReadonlyArray<ExperimentSignal>;
  behavioral?: ReadonlyArray<BehavioralSignal>;
  incidents?: ReadonlyArray<IncidentSignal>;
  /** Janela analisada, em horas (para impacto/hora). */
  window_hours: number;
}

// ---------- Tipos de saída ----------

export type DiagnosticSeverity = 'low' | 'medium' | 'high' | 'critical';
export type DiagnosticPriority = 'low' | 'medium' | 'high' | 'critical';
export type Confidence = 'low' | 'medium' | 'high';

export interface CausalLink {
  from: string;
  to: string;
  reason: string;
}

export interface Diagnostic {
  /** Chave estável para dedupe. */
  id: string;
  /** Tipo da correlação detectada. */
  kind:
    | 'hydration_break'
    | 'ux_confusion'
    | 'friction_block'
    | 'experiment_regression'
    | 'sync_conflict'
    | 'mobile_degradation'
    | 'release_regression'
    | 'incident_cluster'
    | 'completion_collapse';
  severity: DiagnosticSeverity;
  priority: DiagnosticPriority;
  confidence: Confidence;
  affected_phases: string[];
  suspected_root_cause: string;
  /** Explicação humana determinística. */
  explanation: string;
  suggested_actions: string[];
  /** Estimativa de usuários afetados/hora. */
  est_users_affected_per_hour: number;
  /** Estimativa de perda de completion em pp. */
  est_completion_loss_pp: number;
  causal_chain?: CausalLink[];
  /** Contribuições brutas para auditoria. */
  signals: Record<string, number | string>;
}

// ---------- Thresholds (centralizados para tunagem) ----------

export const DECISION_THRESHOLDS = {
  REFRESH_SPIKE_RATIO: 0.15,        // >15% das sessões fazendo refresh
  RECOVERY_CORRUPTION_RATIO: 0.05,  // >5% recoveries vs enters
  RAGE_CLICK_MIN: 5,
  HESITATION_MIN: 10,
  REPEATED_VALIDATION_MIN: 8,
  VALIDATION_FAIL_RATIO: 0.20,      // >20% das tentativas
  AUTOSAVE_FAIL_RATIO: 0.10,
  ABANDON_RATIO_HIGH: 0.40,
  DURATION_BLOCK_MULTIPLIER: 2.5,   // duração >2.5x mediana
  COMPLETION_COLLAPSE_RATE: 0.40,   // <40% completion
  EXPERIMENT_COMPLETION_DROP_PP: 10,
  EXPERIMENT_VALIDATION_INCREASE_PCT: 50,
  MIN_SAMPLE_ENTERS: 20,
  MIN_SAMPLE_SESSIONS: 30,
} as const;

// ---------- Engine público ----------

export interface AnalyzeOptions {
  /** Permite injetar thresholds custom para testes. */
  thresholds?: Partial<typeof DECISION_THRESHOLDS>;
}

export function analyzeOperationalState(
  input: DecisionInput,
  opts: AnalyzeOptions = {},
): Diagnostic[] {
  const T = { ...DECISION_THRESHOLDS, ...(opts.thresholds ?? {}) };
  const diagnostics: Diagnostic[] = [];

  for (const phase of input.funnel) {
    pushIfPresent(diagnostics, detectHydrationBreak(phase, input, T));
    pushIfPresent(diagnostics, detectUxConfusion(phase, input, T));
    pushIfPresent(diagnostics, detectFrictionBlock(phase, input, T));
    pushIfPresent(diagnostics, detectSyncConflict(phase, input, T));
    pushIfPresent(diagnostics, detectCompletionCollapse(phase, input, T));
  }

  pushIfPresent(diagnostics, detectExperimentRegression(input, T));
  diagnostics.push(...detectReleaseRegressions(input, T));
  pushIfPresent(diagnostics, detectMobileDegradation(input, T));
  pushIfPresent(diagnostics, detectIncidentCluster(input));

  const deduped = dedupeDiagnostics(diagnostics);
  return rankOperationalPriorities(deduped);
}

// ---------- Correlações ----------

function detectHydrationBreak(
  p: FunnelPhaseSignal,
  input: DecisionInput,
  T: typeof DECISION_THRESHOLDS,
): Diagnostic | null {
  if (p.unique_sessions < T.MIN_SAMPLE_SESSIONS) return null;
  const refreshRatio = safeDiv(p.refreshes, p.unique_sessions);
  const corruptionRatio = safeDiv(p.recoveries, Math.max(p.enters, 1));
  if (refreshRatio < T.REFRESH_SPIKE_RATIO || corruptionRatio < T.RECOVERY_CORRUPTION_RATIO) {
    return null;
  }
  const release = mostSuspiciousRelease(input);
  const refreshPct = Math.round(refreshRatio * 100);
  const corruptionPct = Math.round(corruptionRatio * 100);
  const releaseSuffix = release ? ` após release ${release.app_version}-${release.release_channel}` : '';
  return {
    id: `hydration_break:${p.phase}`,
    kind: 'hydration_break',
    severity: corruptionRatio > 0.10 ? 'critical' : 'high',
    priority: 'high',
    confidence: refreshRatio > 0.25 ? 'high' : 'medium',
    affected_phases: [p.phase],
    suspected_root_cause: 'Quebra de hidratação local (envelope/checksum inválido ou storage corrompido).',
    explanation:
      `Aumento simultâneo de refresh_rate (~${refreshPct}%) e recovery_corrupted (~${corruptionPct}%) ` +
      `em ${p.phase}${releaseSuffix} sugere regressão de hidratação local.`,
    suggested_actions: [
      'Investigar release recente que alterou persistência ou checksum.',
      'Verificar logs de recovery_corrupted por reason (version_mismatch / checksum_invalid).',
      'Aumentar resiliência local: fallback para snapshot remoto válido.',
    ],
    est_users_affected_per_hour: Math.round(p.refreshes / Math.max(input.window_hours, 1)),
    est_completion_loss_pp: clampPp(corruptionRatio * 100 * 0.5),
    causal_chain: release
      ? [
          { from: `release:${release.app_version}`, to: 'recovery_corrupted', reason: 'Janela coincide' },
          { from: 'recovery_corrupted', to: 'refresh_spike', reason: 'Usuários recarregam após erro' },
          { from: 'refresh_spike', to: `abandono:${p.phase}`, reason: 'Loop de recovery falho' },
        ]
      : undefined,
    signals: {
      refresh_ratio: refreshRatio,
      recovery_corruption_ratio: corruptionRatio,
      refreshes: p.refreshes,
      recoveries: p.recoveries,
    },
  };
}

function detectUxConfusion(
  p: FunnelPhaseSignal,
  input: DecisionInput,
  T: typeof DECISION_THRESHOLDS,
): Diagnostic | null {
  const behavioral = (input.behavioral ?? []).find((b) => b.phase === p.phase);
  const validationRatio = safeDiv(p.validation_failed, Math.max(p.enters, 1));
  const rageClicks = behavioral?.rage_clicks ?? 0;
  if (validationRatio < T.VALIDATION_FAIL_RATIO && rageClicks < T.RAGE_CLICK_MIN) return null;
  if (p.enters < T.MIN_SAMPLE_ENTERS) return null;

  const fields = behavioral?.problematic_fields ?? [];
  const fieldStr = fields.length ? ` (campos: ${fields.slice(0, 3).join(', ')})` : '';
  return {
    id: `ux_confusion:${p.phase}`,
    kind: 'ux_confusion',
    severity: validationRatio > 0.40 ? 'high' : 'medium',
    priority: 'medium',
    confidence: fields.length > 0 ? 'high' : 'medium',
    affected_phases: [p.phase],
    suspected_root_cause: 'UX confusa ou validação estrita demais.',
    explanation:
      `Explosão de validation_failed (~${Math.round(validationRatio * 100)}%) ` +
      `combinada com ${rageClicks} rage-clicks em ${p.phase}${fieldStr} sugere fricção de interface.`,
    suggested_actions: [
      'Revisar mensagens de erro e exemplos de input nos campos problemáticos.',
      'Considerar máscara de input ou auto-formatação.',
      'Avaliar abrandar regex de validação.',
    ],
    est_users_affected_per_hour: Math.round(p.validation_failed / Math.max(input.window_hours, 1)),
    est_completion_loss_pp: clampPp(validationRatio * 100 * 0.3),
    signals: {
      validation_ratio: validationRatio,
      rage_clicks: rageClicks,
      problematic_fields: fields.join(',') || 'n/a',
    },
  };
}

function detectFrictionBlock(
  p: FunnelPhaseSignal,
  input: DecisionInput,
  T: typeof DECISION_THRESHOLDS,
): Diagnostic | null {
  if (p.enters < T.MIN_SAMPLE_ENTERS) return null;
  const abandonRatio = safeDiv(p.abandons, p.enters);
  const allDurations = input.funnel.map((x) => x.median_duration_s ?? 0).filter((x) => x > 0);
  const median = allDurations.length ? medianOf(allDurations) : 0;
  const duration = p.median_duration_s ?? p.avg_duration_s ?? 0;
  const isSlow = median > 0 && duration > median * T.DURATION_BLOCK_MULTIPLIER;
  if (abandonRatio < T.ABANDON_RATIO_HIGH && !isSlow) return null;

  return {
    id: `friction_block:${p.phase}`,
    kind: 'friction_block',
    severity: abandonRatio > 0.55 ? 'critical' : 'high',
    priority: abandonRatio > 0.55 ? 'critical' : 'high',
    confidence: isSlow && abandonRatio > T.ABANDON_RATIO_HIGH ? 'high' : 'medium',
    affected_phases: [p.phase],
    suspected_root_cause: 'Bloqueio ou fricção elevada nesta fase.',
    explanation:
      `Abandono (~${Math.round(abandonRatio * 100)}%)` +
      (isSlow ? ` e duração ${duration}s (vs mediana ${Math.round(median)}s)` : '') +
      ` em ${p.phase} indicam bloqueio operacional.`,
    suggested_actions: [
      'Auditar requisitos obrigatórios desta fase — reduzir se possível.',
      'Adicionar opção de "Pular por enquanto" se aplicável.',
      'Verificar dependências externas (GPS, CEP, upload) lentas ou falhando.',
    ],
    est_users_affected_per_hour: Math.round(p.abandons / Math.max(input.window_hours, 1)),
    est_completion_loss_pp: clampPp(abandonRatio * 100 * 0.6),
    signals: {
      abandon_ratio: abandonRatio,
      median_duration_s: duration,
      global_median_s: median,
    },
  };
}

function detectSyncConflict(
  p: FunnelPhaseSignal,
  _input: DecisionInput,
  T: typeof DECISION_THRESHOLDS,
): Diagnostic | null {
  if (p.unique_sessions < T.MIN_SAMPLE_SESSIONS) return null;
  const autosaveRatio = safeDiv(p.autosave_failed, p.unique_sessions);
  if (autosaveRatio < T.AUTOSAVE_FAIL_RATIO) return null;
  return {
    id: `sync_conflict:${p.phase}`,
    kind: 'sync_conflict',
    severity: autosaveRatio > 0.25 ? 'critical' : 'high',
    priority: 'high',
    confidence: 'medium',
    affected_phases: [p.phase],
    suspected_root_cause: 'Conflito de sincronização (multi-tab, RLS ou rede).',
    explanation:
      `autosave_failed em ~${Math.round(autosaveRatio * 100)}% das sessões de ${p.phase} ` +
      `sugere conflito de sincronização remota.`,
    suggested_actions: [
      'Revisar heartbeat multi-tab (concurrent_tab_detected).',
      'Auditar políticas RLS da tabela onboarding_v2_drafts.',
      'Aumentar backoff/retry no autosave remoto.',
    ],
    est_users_affected_per_hour: Math.round(p.autosave_failed / Math.max(_input.window_hours, 1)),
    est_completion_loss_pp: clampPp(autosaveRatio * 100 * 0.2),
    signals: { autosave_fail_ratio: autosaveRatio, autosave_failed: p.autosave_failed },
  };
}

function detectCompletionCollapse(
  p: FunnelPhaseSignal,
  input: DecisionInput,
  T: typeof DECISION_THRESHOLDS,
): Diagnostic | null {
  if (p.enters < T.MIN_SAMPLE_ENTERS) return null;
  const rate = safeDiv(p.completes, p.enters);
  if (rate >= T.COMPLETION_COLLAPSE_RATE || p.completes === 0 && p.enters < 50) return null;
  if (rate >= T.COMPLETION_COLLAPSE_RATE) return null;
  const exp = (input.experiments ?? []).find(
    (e) => e.status === 'running' && (e.affected_phase === p.phase || !e.affected_phase),
  );
  return {
    id: `completion_collapse:${p.phase}`,
    kind: 'completion_collapse',
    severity: rate < 0.20 ? 'critical' : 'high',
    priority: 'critical',
    confidence: p.enters > 100 ? 'high' : 'medium',
    affected_phases: [p.phase],
    suspected_root_cause: exp
      ? `Possível regressão induzida pelo experimento "${exp.key}".`
      : 'Colapso de completion sem causa única óbvia.',
    explanation:
      `Completion de ${p.phase} em ${Math.round(rate * 100)}% (limiar ${Math.round(T.COMPLETION_COLLAPSE_RATE * 100)}%).` +
      (exp ? ` Experimento "${exp.key}" está rodando nesta fase.` : ''),
    suggested_actions: exp
      ? [
          `Pausar experimento "${exp.key}" para isolar causa.`,
          'Comparar variantes via admin_onboarding_ops_funnel.',
          'Reverter para controle se queda persistir após 30min.',
        ]
      : [
          'Cruzar com Releases tab para identificar release recente.',
          'Verificar regressões automáticas detectadas.',
          'Abrir incident de gravidade alta.',
        ],
    est_users_affected_per_hour: Math.round((p.enters - p.completes) / Math.max(input.window_hours, 1)),
    est_completion_loss_pp: clampPp((T.COMPLETION_COLLAPSE_RATE - rate) * 100),
    signals: { completion_rate: rate, enters: p.enters, completes: p.completes },
  };
}

function detectExperimentRegression(
  input: DecisionInput,
  T: typeof DECISION_THRESHOLDS,
): Diagnostic | null {
  const risky = (input.experiments ?? []).find(
    (e) =>
      e.status === 'running' &&
      ((e.completion_drop_pp ?? 0) >= T.EXPERIMENT_COMPLETION_DROP_PP ||
        (e.validation_increase_pct ?? 0) >= T.EXPERIMENT_VALIDATION_INCREASE_PCT),
  );
  if (!risky) return null;
  return {
    id: `experiment_regression:${risky.key}`,
    kind: 'experiment_regression',
    severity: (risky.completion_drop_pp ?? 0) >= 20 ? 'critical' : 'high',
    priority: 'critical',
    confidence: 'high',
    affected_phases: risky.affected_phase ? [risky.affected_phase] : [],
    suspected_root_cause: `Variante do experimento "${risky.key}" degradando conversão.`,
    explanation:
      `Experimento "${risky.key}" apresenta queda de ${risky.completion_drop_pp ?? 0}pp em completion ` +
      `e/ou +${risky.validation_increase_pct ?? 0}% em validation_failures.`,
    suggested_actions: [
      `Pausar manualmente "${risky.key}" pelo painel de Experiments.`,
      'Capturar snapshot antes de pausar para análise post-mortem.',
      'Avaliar ativar kill-switch automático global se o padrão se repetir.',
    ],
    est_users_affected_per_hour: 0,
    est_completion_loss_pp: clampPp(risky.completion_drop_pp ?? 0),
    causal_chain: [
      { from: `experiment:${risky.key}`, to: 'completion_drop', reason: 'Variante ativa' },
    ],
    signals: {
      completion_drop_pp: risky.completion_drop_pp ?? 0,
      validation_increase_pct: risky.validation_increase_pct ?? 0,
    },
  };
}

function detectReleaseRegressions(
  input: DecisionInput,
  T: typeof DECISION_THRESHOLDS,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const releases = input.releases ?? [];
  if (releases.length < 2) return out;
  const ordered = [...releases].sort((a, b) => b.unique_sessions - a.unique_sessions);
  const baseline = ordered[0];
  for (const r of ordered.slice(1)) {
    if (r.unique_sessions < T.MIN_SAMPLE_SESSIONS) continue;
    const dropPp = (baseline.completion_rate - r.completion_rate) * 100;
    if (dropPp < 8) continue;
    out.push({
      id: `release_regression:${r.app_version}:${r.release_channel}`,
      kind: 'release_regression',
      severity: dropPp >= 20 ? 'critical' : dropPp >= 12 ? 'high' : 'medium',
      priority: dropPp >= 20 ? 'critical' : 'high',
      confidence: r.unique_sessions > 100 ? 'high' : 'medium',
      affected_phases: [],
      suspected_root_cause: `Release ${r.app_version}-${r.release_channel} com performance inferior ao baseline.`,
      explanation:
        `Release ${r.app_version}-${r.release_channel} apresenta completion ${Math.round(r.completion_rate * 100)}% ` +
        `vs baseline ${baseline.app_version}-${baseline.release_channel} (${Math.round(baseline.completion_rate * 100)}%). ` +
        `Queda de ${Math.round(dropPp)}pp.`,
      suggested_actions:
        r.release_channel !== 'stable'
          ? [
              `Bloquear promoção de ${r.app_version} para canal estável.`,
              'Cruzar com Gatekeeper para health score.',
              'Investigar diffs com baseline.',
            ]
          : [
              'Considerar rollback do release.',
              'Abrir incident de gravidade alta.',
              'Cruzar com Gatekeeper antes de qualquer próximo deploy.',
            ],
      est_users_affected_per_hour: Math.round(r.abandons / Math.max(input.window_hours, 1)),
      est_completion_loss_pp: clampPp(dropPp),
      signals: {
        baseline_completion: baseline.completion_rate,
        candidate_completion: r.completion_rate,
        drop_pp: dropPp,
      },
    });
  }
  return out;
}

function detectMobileDegradation(input: DecisionInput, _T: typeof DECISION_THRESHOLDS): Diagnostic | null {
  const behavioral = input.behavioral ?? [];
  const mobile = behavioral.filter((b) => b.device === 'mobile');
  const desktop = behavioral.filter((b) => b.device === 'desktop');
  if (mobile.length === 0 || desktop.length === 0) return null;
  const mobileRage = sum(mobile.map((b) => b.rage_clicks));
  const desktopRage = sum(desktop.map((b) => b.rage_clicks));
  if (mobileRage < 10 || mobileRage < desktopRage * 2.5) return null;
  return {
    id: 'mobile_degradation:global',
    kind: 'mobile_degradation',
    severity: 'high',
    priority: 'high',
    confidence: mobileRage > desktopRage * 4 ? 'high' : 'medium',
    affected_phases: Array.from(new Set(mobile.map((b) => b.phase))),
    suspected_root_cause: 'Degradação específica de mobile (touch, viewport ou input).',
    explanation:
      `Mobile concentra ${mobileRage} rage-clicks vs ${desktopRage} em desktop — ` +
      `assimetria sugere problema responsivo.`,
    suggested_actions: [
      'Testar fluxo em Safari iOS e Chrome Android.',
      'Auditar tamanho de touch-targets nas fases afetadas.',
      'Verificar inputs específicos (CEP, telefone, máscara).',
    ],
    est_users_affected_per_hour: Math.round(mobileRage / Math.max(input.window_hours, 1)),
    est_completion_loss_pp: 3,
    signals: { mobile_rage: mobileRage, desktop_rage: desktopRage },
  };
}

function detectIncidentCluster(input: DecisionInput): Diagnostic | null {
  const open = (input.incidents ?? []).filter((i) => i.status === 'open');
  if (open.length < 3) return null;
  const critical = open.filter((i) => i.severity === 'critical' || i.severity === 'high').length;
  return {
    id: 'incident_cluster:open',
    kind: 'incident_cluster',
    severity: critical >= 2 ? 'critical' : 'high',
    priority: critical >= 2 ? 'critical' : 'high',
    confidence: 'high',
    affected_phases: [],
    suspected_root_cause: 'Múltiplos incidents abertos simultaneamente — possível cascata.',
    explanation: `${open.length} incidents abertos (${critical} alto/crítico). Possível cascata operacional.`,
    suggested_actions: [
      'Revisar incidents na aba Incidentes — buscar causa raiz comum.',
      'Considerar ativar auto-response em modo defensivo.',
      'Pausar deploys até estabilizar.',
    ],
    est_users_affected_per_hour: 0,
    est_completion_loss_pp: 0,
    signals: { open_count: open.length, high_or_critical: critical },
  };
}

// ---------- Helpers ----------

function pushIfPresent<T>(arr: T[], item: T | null) {
  if (item) arr.push(item);
}

function safeDiv(n: number, d: number): number {
  if (!d || d <= 0) return 0;
  return n / d;
}

function sum(xs: number[]): number {
  let acc = 0;
  for (const x of xs) acc += x;
  return acc;
}

function medianOf(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clampPp(v: number): number {
  if (!isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v * 10) / 10));
}

function mostSuspiciousRelease(input: DecisionInput): ReleaseSignal | null {
  const list = (input.releases ?? []).filter((r) => r.unique_sessions >= 20);
  if (list.length === 0) return null;
  return [...list].sort((a, b) => a.completion_rate - b.completion_rate)[0];
}

/** Remove diagnósticos duplicados por id, mantendo o de maior severity. */
export function dedupeDiagnostics(list: Diagnostic[]): Diagnostic[] {
  const sevRank: Record<DiagnosticSeverity, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  const map = new Map<string, Diagnostic>();
  for (const d of list) {
    const existing = map.get(d.id);
    if (!existing || sevRank[d.severity] > sevRank[existing.severity]) {
      map.set(d.id, d);
    }
  }
  return Array.from(map.values());
}

/** Ordena por priority desc, depois severity desc, depois impacto. */
export function rankOperationalPriorities(list: Diagnostic[]): Diagnostic[] {
  const prioRank: Record<DiagnosticPriority, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  const sevRank: Record<DiagnosticSeverity, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  return [...list].sort((a, b) => {
    if (prioRank[b.priority] !== prioRank[a.priority]) return prioRank[b.priority] - prioRank[a.priority];
    if (sevRank[b.severity] !== sevRank[a.severity]) return sevRank[b.severity] - sevRank[a.severity];
    return b.est_completion_loss_pp - a.est_completion_loss_pp;
  });
}

/** Forensic summary: top-N por categoria. */
export interface ForensicSummary {
  top_abandonment_causes: Array<{ phase: string; abandons: number }>;
  riskiest_releases: Array<{ app_version: string; channel: string; drop_pp: number }>;
  riskiest_experiments: Array<{ key: string; drop_pp: number }>;
  most_friction_fields: string[];
  most_unstable_phases: Array<{ phase: string; instability_score: number }>;
}

export function generateForensicSummary(input: DecisionInput): ForensicSummary {
  const abandons = [...input.funnel]
    .sort((a, b) => b.abandons - a.abandons)
    .slice(0, 3)
    .map((p) => ({ phase: p.phase, abandons: p.abandons }));

  const releases = (input.releases ?? []);
  const baseline = releases.length ? [...releases].sort((a, b) => b.unique_sessions - a.unique_sessions)[0] : null;
  const riskyReleases = baseline
    ? releases
        .filter((r) => r.app_version !== baseline.app_version || r.release_channel !== baseline.release_channel)
        .map((r) => ({
          app_version: r.app_version,
          channel: r.release_channel,
          drop_pp: Math.round((baseline.completion_rate - r.completion_rate) * 1000) / 10,
        }))
        .filter((r) => r.drop_pp > 0)
        .sort((a, b) => b.drop_pp - a.drop_pp)
        .slice(0, 3)
    : [];

  const experiments = (input.experiments ?? [])
    .filter((e) => e.status === 'running' && (e.completion_drop_pp ?? 0) > 0)
    .sort((a, b) => (b.completion_drop_pp ?? 0) - (a.completion_drop_pp ?? 0))
    .slice(0, 3)
    .map((e) => ({ key: e.key, drop_pp: e.completion_drop_pp ?? 0 }));

  const allFields: string[] = [];
  for (const b of input.behavioral ?? []) {
    if (b.problematic_fields) allFields.push(...b.problematic_fields);
  }
  const counts = new Map<string, number>();
  for (const f of allFields) counts.set(f, (counts.get(f) ?? 0) + 1);
  const mostFrictionFields = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([f]) => f);

  const unstable = input.funnel
    .map((p) => ({
      phase: p.phase,
      instability_score:
        p.refreshes * 1 +
        p.recoveries * 3 +
        p.autosave_failed * 4 +
        p.validation_failed * 2 +
        p.regressions * 5,
    }))
    .sort((a, b) => b.instability_score - a.instability_score)
    .slice(0, 3);

  return {
    top_abandonment_causes: abandons,
    riskiest_releases: riskyReleases,
    riskiest_experiments: experiments,
    most_friction_fields: mostFrictionFields,
    most_unstable_phases: unstable,
  };
}

/** Score operacional global 0..100 (100 = saudável). */
export function computeGlobalOperationalScore(diagnostics: Diagnostic[]): number {
  if (diagnostics.length === 0) return 100;
  const penalty = diagnostics.reduce((acc, d) => {
    const w = d.severity === 'critical' ? 25 : d.severity === 'high' ? 12 : d.severity === 'medium' ? 5 : 2;
    return acc + w;
  }, 0);
  return Math.max(0, 100 - penalty);
}

/**
 * Onboarding Business Impact Engine · executive layer
 *
 * Traduz sinais operacionais (funnel, releases, experimentos, incidentes,
 * behavior) em métricas de impacto de negócio. 100% determinístico, 100%
 * heurístico, 100% auditável. Sem ML, sem IA, sem previsão probabilística.
 *
 * Todas as constantes são públicas e ajustáveis. Nenhuma estimativa é
 * apresentada como verdade absoluta — sempre rotulada como "estimado".
 *
 * NÃO altera onboarding, persistência ou billing. Camada read-only.
 */

// =============================================================================
// CONSTANTES HEURÍSTICAS (auditáveis)
// =============================================================================

/** Mínimo de sessions na janela para emitir estimativas. Evita ruído. */
export const MIN_SAMPLE_FOR_ESTIMATE = 50;

/** Baseline saudável de completion rate do onboarding (referência interna). */
export const BASELINE_COMPLETION_RATE = 0.65;

/**
 * Conversão média de "onboarding completo → lead enviado" (heurística
 * de produto, não financeiro real). Ajustável quando tivermos dados.
 */
export const COMPLETED_USER_TO_LEAD_RATIO = 0.35;

/**
 * Valor relativo médio de um lead em "unidades de impacto" (não R$).
 * Mantemos abstrato de propósito — esta camada NÃO é financeira.
 */
export const LEAD_RELATIVE_VALUE_UNITS = 1;

/** Pesos do Business Health Score (somam 100). */
export const HEALTH_WEIGHTS = {
  completion_stability: 25,
  abandonment_trend: 20,
  friction_severity: 15,
  release_stability: 15,
  experiment_health: 5,
  incident_pressure: 10,
  recovery_reliability: 10,
} as const;

/** Bandas de classificação (score 0..100). */
export const HEALTH_BANDS = {
  excellent: 85,
  healthy: 70,
  warning: 55,
  degraded: 40,
  // < 40 = critical
} as const;

export type HealthBand = 'excellent' | 'healthy' | 'warning' | 'degraded' | 'critical';

// =============================================================================
// TIPOS DE ENTRADA
// =============================================================================

export interface FunnelSnapshot {
  /** Sessions únicas que entraram no onboarding. */
  enters: number;
  /** Sessions que completaram. */
  completes: number;
  /** Sessions que abandonaram. */
  abandons: number;
  /** Falhas de validação acumuladas. */
  validation_failed: number;
  /** Falhas de autosave acumuladas. */
  autosave_failed: number;
  /** Recoveries acionadas. */
  recoveries: number;
  /** Refreshes durante o flow. */
  refreshes: number;
  /** Janela em horas representada pelo snapshot. */
  window_hours: number;
}

export interface ReleaseSnapshot {
  app_version: string;
  release_channel?: string;
  unique_sessions: number;
  completion_rate: number; // 0..1
  abandon_rate: number;    // 0..1
  validation_fail_rate: number; // 0..1
  regressions_detected: number;
}

export interface ExperimentSnapshot {
  experiment_key: string;
  status: 'draft' | 'running' | 'paused' | 'auto_disabled' | 'completed';
  control_completion_rate: number; // 0..1
  variant_completion_rate: number; // 0..1
  control_sessions: number;
  variant_sessions: number;
}

export interface IncidentSnapshot {
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  /** Horas desde abertura. */
  age_hours: number;
}

// =============================================================================
// HELPERS
// =============================================================================

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const pct = (n: number) => Math.round(n * 1000) / 10; // 0.123 -> 12.3
const safeRatio = (num: number, den: number) => (den > 0 ? num / den : 0);

export function classifyHealth(score: number): HealthBand {
  if (score >= HEALTH_BANDS.excellent) return 'excellent';
  if (score >= HEALTH_BANDS.healthy) return 'healthy';
  if (score >= HEALTH_BANDS.warning) return 'warning';
  if (score >= HEALTH_BANDS.degraded) return 'degraded';
  return 'critical';
}

// =============================================================================
// CONVERSION IMPACT
// =============================================================================

export interface ConversionImpactInput {
  current: FunnelSnapshot;
  baseline?: FunnelSnapshot | null;
}

export interface ConversionImpact {
  current_completion_rate: number;       // 0..1
  baseline_completion_rate: number;      // 0..1 (efetiva usada)
  estimated_loss_pp: number;             // pontos percentuais (positivo = perda)
  estimated_users_lost: number;          // arredondado
  estimated_leads_lost: number;          // arredondado
  estimated_revenue_risk_units: number;  // relativo
  sample_sufficient: boolean;
}

/**
 * Calcula perda estimada de conversão comparando o snapshot atual com um
 * baseline. Se não houver baseline confiável, usa `BASELINE_COMPLETION_RATE`.
 * Retorna 0 quando amostra insuficiente — anti-falso-positivo.
 */
export function estimateConversionLoss(input: ConversionImpactInput): ConversionImpact {
  const cur = input.current;
  const baseRate = (() => {
    const b = input.baseline;
    if (b && b.enters >= MIN_SAMPLE_FOR_ESTIMATE) {
      return clamp(safeRatio(b.completes, b.enters));
    }
    return BASELINE_COMPLETION_RATE;
  })();
  const curRate = clamp(safeRatio(cur.completes, cur.enters));
  const sampleSufficient = cur.enters >= MIN_SAMPLE_FOR_ESTIMATE;
  const rawLoss = baseRate - curRate;
  const lossPp = sampleSufficient && rawLoss > 0 ? pct(rawLoss) : 0;

  const usersLost = sampleSufficient && rawLoss > 0
    ? Math.round(cur.enters * rawLoss)
    : 0;
  const leadsLost = Math.round(usersLost * COMPLETED_USER_TO_LEAD_RATIO);
  const revenueRisk = Math.round(leadsLost * LEAD_RELATIVE_VALUE_UNITS);

  return {
    current_completion_rate: curRate,
    baseline_completion_rate: baseRate,
    estimated_loss_pp: lossPp,
    estimated_users_lost: usersLost,
    estimated_leads_lost: leadsLost,
    estimated_revenue_risk_units: revenueRisk,
    sample_sufficient: sampleSufficient,
  };
}

// =============================================================================
// OPERATIONAL COST (custo operacional heurístico em "unidades")
// =============================================================================

export interface OperationalCost {
  recovery_load: number;       // recoveries / hora
  validation_pressure: number; // falhas / hora
  autosave_pressure: number;   // falhas / hora
  refresh_pressure: number;    // refreshes / hora
  /** Score 0..100 (quanto maior, pior). */
  cost_score: number;
}

export function estimateOperationalCost(f: FunnelSnapshot): OperationalCost {
  const h = Math.max(1, f.window_hours);
  const recovery = f.recoveries / h;
  const validation = f.validation_failed / h;
  const autosave = f.autosave_failed / h;
  const refresh = f.refreshes / h;
  // Pesos: autosave > validation > refresh > recovery
  const raw = autosave * 4 + validation * 3 + refresh * 2 + recovery * 1;
  // Normaliza assumindo que 50 pts/hora = 100% custo.
  const score = clamp(raw / 50, 0, 1) * 100;
  return {
    recovery_load: Math.round(recovery * 10) / 10,
    validation_pressure: Math.round(validation * 10) / 10,
    autosave_pressure: Math.round(autosave * 10) / 10,
    refresh_pressure: Math.round(refresh * 10) / 10,
    cost_score: Math.round(score),
  };
}

// =============================================================================
// LEAD IMPACT (conversão → lead)
// =============================================================================

export function estimateLeadImpact(f: FunnelSnapshot): {
  estimated_leads_generated: number;
  estimated_leads_at_risk: number;
} {
  const generated = Math.round(f.completes * COMPLETED_USER_TO_LEAD_RATIO);
  const atRisk = Math.round(f.abandons * COMPLETED_USER_TO_LEAD_RATIO * 0.5);
  return {
    estimated_leads_generated: generated,
    estimated_leads_at_risk: atRisk,
  };
}

// =============================================================================
// GROWTH TREND
// =============================================================================

export type TrendDirection = 'up' | 'flat' | 'down';

export interface GrowthTrend {
  current_rate: number;       // 0..1
  previous_rate: number;      // 0..1
  delta_pp: number;           // pontos percentuais
  direction: TrendDirection;
  /** Insuficiente em uma das janelas → não classifica. */
  sample_sufficient: boolean;
}

export function estimateGrowthTrend(current: FunnelSnapshot, previous: FunnelSnapshot): GrowthTrend {
  const curRate = clamp(safeRatio(current.completes, current.enters));
  const prevRate = clamp(safeRatio(previous.completes, previous.enters));
  const sampleSufficient =
    current.enters >= MIN_SAMPLE_FOR_ESTIMATE && previous.enters >= MIN_SAMPLE_FOR_ESTIMATE;
  const deltaPp = sampleSufficient ? pct(curRate - prevRate) : 0;
  let direction: TrendDirection = 'flat';
  if (sampleSufficient) {
    if (deltaPp >= 1) direction = 'up';
    else if (deltaPp <= -1) direction = 'down';
  }
  return { current_rate: curRate, previous_rate: prevRate, delta_pp: deltaPp, direction, sample_sufficient: sampleSufficient };
}

// =============================================================================
// RELEASE BUSINESS IMPACT
// =============================================================================

export interface ReleaseImpactRow {
  app_version: string;
  release_channel?: string;
  sessions: number;
  completion_rate: number;
  abandon_rate: number;
  validation_fail_rate: number;
  regressions: number;
  /** Score de risco 0..100. */
  risk_score: number;
  /** Etiqueta: stable | watch | risky | critical. */
  risk_band: 'stable' | 'watch' | 'risky' | 'critical';
  estimated_users_lost: number;
}

export function computeReleaseImpact(releases: ReleaseSnapshot[]): ReleaseImpactRow[] {
  return releases.map((r) => {
    const baseline = BASELINE_COMPLETION_RATE;
    const completionGap = Math.max(0, baseline - r.completion_rate);
    const usersLost = r.unique_sessions >= MIN_SAMPLE_FOR_ESTIMATE
      ? Math.round(r.unique_sessions * completionGap)
      : 0;
    // Risk = gap completion*60 + abandon*20 + validation*10 + regressions*10
    const raw =
      completionGap * 100 * 0.6 +
      r.abandon_rate * 100 * 0.2 +
      r.validation_fail_rate * 100 * 0.1 +
      Math.min(10, r.regressions_detected) * 1.0;
    const risk = Math.round(clamp(raw, 0, 100));
    let band: ReleaseImpactRow['risk_band'] = 'stable';
    if (risk >= 70) band = 'critical';
    else if (risk >= 45) band = 'risky';
    else if (risk >= 25) band = 'watch';
    return {
      app_version: r.app_version,
      release_channel: r.release_channel,
      sessions: r.unique_sessions,
      completion_rate: r.completion_rate,
      abandon_rate: r.abandon_rate,
      validation_fail_rate: r.validation_fail_rate,
      regressions: r.regressions_detected,
      risk_score: risk,
      risk_band: band,
      estimated_users_lost: usersLost,
    };
  });
}

export function rankRiskyReleases(rows: ReleaseImpactRow[], topN = 5): ReleaseImpactRow[] {
  return [...rows].sort((a, b) => b.risk_score - a.risk_score).slice(0, topN);
}

export function rankStableReleases(rows: ReleaseImpactRow[], topN = 5): ReleaseImpactRow[] {
  return [...rows]
    .filter((r) => r.sessions >= MIN_SAMPLE_FOR_ESTIMATE)
    .sort((a, b) => a.risk_score - b.risk_score)
    .slice(0, topN);
}

// =============================================================================
// EXPERIMENT ROI
// =============================================================================

export interface ExperimentRoi {
  experiment_key: string;
  status: ExperimentSnapshot['status'];
  uplift_pp: number;             // positivo = variant melhor
  net_impact_users: number;      // estimado sobre amostra
  confidence_band: 'low' | 'medium' | 'high';
  verdict: 'winner' | 'loser' | 'inconclusive' | 'risky';
}

export function estimateExperimentRoi(exp: ExperimentSnapshot): ExperimentRoi {
  const upliftRaw = exp.variant_completion_rate - exp.control_completion_rate;
  const uplift = pct(upliftRaw);
  const totalSessions = exp.control_sessions + exp.variant_sessions;
  const netImpact = Math.round(exp.variant_sessions * upliftRaw);

  let confidence: ExperimentRoi['confidence_band'] = 'low';
  if (exp.control_sessions >= 500 && exp.variant_sessions >= 500) confidence = 'high';
  else if (exp.control_sessions >= 150 && exp.variant_sessions >= 150) confidence = 'medium';

  let verdict: ExperimentRoi['verdict'] = 'inconclusive';
  if (exp.status === 'auto_disabled') verdict = 'risky';
  else if (totalSessions < 200) verdict = 'inconclusive';
  else if (uplift >= 2 && confidence !== 'low') verdict = 'winner';
  else if (uplift <= -2 && confidence !== 'low') verdict = 'loser';

  return {
    experiment_key: exp.experiment_key,
    status: exp.status,
    uplift_pp: uplift,
    net_impact_users: netImpact,
    confidence_band: confidence,
    verdict,
  };
}

// =============================================================================
// BUSINESS HEALTH SCORE
// =============================================================================

export interface HealthInput {
  funnel: FunnelSnapshot;
  previousFunnel?: FunnelSnapshot | null;
  releases?: ReleaseSnapshot[];
  experiments?: ExperimentSnapshot[];
  incidents?: IncidentSnapshot[];
}

export interface BusinessHealth {
  score: number;                 // 0..100
  band: HealthBand;
  operational_score: number;     // 0..100 (recuperação, autosave, etc.)
  breakdown: Record<keyof typeof HEALTH_WEIGHTS, number>;
}

export function computeBusinessHealthScore(input: HealthInput): BusinessHealth {
  const f = input.funnel;
  const enters = Math.max(1, f.enters);

  // 1. completion stability: razão com baseline
  const completion = safeRatio(f.completes, enters);
  const completionScore = clamp(completion / BASELINE_COMPLETION_RATE) * 100;

  // 2. abandonment trend: melhor que window anterior?
  let abandonScore = 60;
  if (input.previousFunnel && input.previousFunnel.enters >= MIN_SAMPLE_FOR_ESTIMATE) {
    const prevAbandon = safeRatio(input.previousFunnel.abandons, input.previousFunnel.enters);
    const curAbandon = safeRatio(f.abandons, enters);
    const diff = prevAbandon - curAbandon; // positivo = melhorou
    abandonScore = clamp(0.6 + diff * 5) * 100;
  } else {
    const curAbandon = safeRatio(f.abandons, enters);
    abandonScore = clamp(1 - curAbandon * 2) * 100;
  }

  // 3. friction severity: validation+autosave por sessão
  const frictionPerSession = (f.validation_failed + f.autosave_failed) / enters;
  const frictionScore = clamp(1 - frictionPerSession * 2) * 100;

  // 4. release stability: pior release dita o tom
  let releaseScore = 80;
  if (input.releases && input.releases.length > 0) {
    const impacts = computeReleaseImpact(input.releases);
    const worst = Math.max(...impacts.map((r) => r.risk_score));
    releaseScore = clamp(1 - worst / 100) * 100;
  }

  // 5. experiment health
  let experimentScore = 80;
  if (input.experiments && input.experiments.length > 0) {
    const rois = input.experiments.map(estimateExperimentRoi);
    const risky = rois.filter((r) => r.verdict === 'risky').length;
    const losers = rois.filter((r) => r.verdict === 'loser').length;
    experimentScore = clamp(1 - (risky * 0.4 + losers * 0.2) / rois.length) * 100;
  }

  // 6. incident pressure (open + age + severity)
  let incidentScore = 100;
  if (input.incidents && input.incidents.length > 0) {
    const open = input.incidents.filter((i) => !i.resolved);
    const weight = open.reduce((acc, i) => {
      const sev = i.severity === 'critical' ? 25 : i.severity === 'high' ? 15 : i.severity === 'medium' ? 8 : 3;
      const ageBoost = Math.min(2, i.age_hours / 24);
      return acc + sev * (1 + ageBoost);
    }, 0);
    incidentScore = clamp(1 - weight / 100) * 100;
  }

  // 7. recovery reliability: quantos recoveries vs autosave_failed?
  const recoveryDen = f.autosave_failed + f.recoveries;
  const recoveryRate = recoveryDen > 0 ? f.recoveries / recoveryDen : 1;
  const recoveryScore = clamp(recoveryRate) * 100;

  const breakdown = {
    completion_stability: completionScore,
    abandonment_trend: abandonScore,
    friction_severity: frictionScore,
    release_stability: releaseScore,
    experiment_health: experimentScore,
    incident_pressure: incidentScore,
    recovery_reliability: recoveryScore,
  };

  const total = (Object.keys(HEALTH_WEIGHTS) as Array<keyof typeof HEALTH_WEIGHTS>).reduce((acc, k) => {
    return acc + (breakdown[k] * HEALTH_WEIGHTS[k]) / 100;
  }, 0);

  const score = Math.round(clamp(total / 100) * 100);
  const opsScore = Math.round(
    (frictionScore * 0.35 + recoveryScore * 0.25 + incidentScore * 0.25 + releaseScore * 0.15),
  );

  return {
    score,
    band: classifyHealth(score),
    operational_score: opsScore,
    breakdown,
  };
}

// =============================================================================
// EXECUTIVE SUMMARIES (templates determinísticos)
// =============================================================================

export interface ExecutiveSummary {
  highest_risk: string;
  most_unstable_release: string | null;
  best_experiment: string | null;
  worst_experiment: string | null;
  recoverable_leads_estimate: number;
  notes: string[];
}

export function buildExecutiveSummary(args: {
  health: BusinessHealth;
  conversion: ConversionImpact;
  releases: ReleaseImpactRow[];
  experiments: ExperimentRoi[];
}): ExecutiveSummary {
  const notes: string[] = [];

  const risky = rankRiskyReleases(args.releases, 1)[0];
  const mostUnstable = risky && risky.risk_score >= 25 ? `${risky.app_version} (risco ${risky.risk_score})` : null;

  const winners = args.experiments.filter((e) => e.verdict === 'winner').sort((a, b) => b.uplift_pp - a.uplift_pp);
  const losers = args.experiments.filter((e) => e.verdict === 'loser' || e.verdict === 'risky')
    .sort((a, b) => a.uplift_pp - b.uplift_pp);
  const bestExp = winners[0] ? `${winners[0].experiment_key} (+${winners[0].uplift_pp}pp)` : null;
  const worstExp = losers[0] ? `${losers[0].experiment_key} (${losers[0].uplift_pp}pp)` : null;

  let highest = 'Funil estável dentro da banda esperada.';
  if (args.health.band === 'critical') highest = 'Saúde crítica do onboarding — investigar imediatamente.';
  else if (args.health.band === 'degraded') highest = 'Funil degradado — pressão operacional elevada.';
  else if (args.conversion.estimated_loss_pp >= 5) highest = `Perda estimada de ${args.conversion.estimated_loss_pp}pp na conversão.`;
  else if (mostUnstable) highest = `Release instável em produção: ${mostUnstable}.`;

  if (args.conversion.estimated_users_lost > 0) {
    notes.push(`Estimativa de ${args.conversion.estimated_users_lost} usuários perdidos na janela atual.`);
  }
  if (mostUnstable) notes.push(`Release mais instável: ${mostUnstable}.`);
  if (bestExp) notes.push(`Experimento com maior impacto positivo: ${bestExp}.`);
  if (worstExp) notes.push(`Experimento com maior risco/queda: ${worstExp}.`);

  return {
    highest_risk: highest,
    most_unstable_release: mostUnstable,
    best_experiment: bestExp,
    worst_experiment: worstExp,
    recoverable_leads_estimate: args.conversion.estimated_leads_lost,
    notes,
  };
}

/**
 * Detector de regressão do Onboarding — núcleo puro (sem rede, sem DOM).
 *
 * Objetivo:
 *  Comparar uma janela "atual" (ex.: última 1h) contra um baseline saudável
 *  (ex.: 7 dias móveis) e emitir anomalias classificadas por severidade.
 *
 * Por que puro?
 *  - Permite testar 100% determinístico via Vitest.
 *  - Permite rodar tanto no cliente (debug) quanto refletir a lógica que a
 *    RPC server-side aplica (mesmo contrato de thresholds/severidade).
 *
 * NÃO faz I/O. NÃO consulta banco. NÃO depende de React/Supabase.
 * O caller (RPC SQL ou job admin) é quem busca os contadores e chama o
 * `classifyMetric` / `detectRegressions` aqui.
 */

export type Severity = 'low' | 'medium' | 'high' | 'critical';

/** Direção em que um aumento é ruim. */
export type Direction = 'higher_is_worse' | 'lower_is_worse';

/** Definição declarativa de uma métrica monitorada. */
export interface MetricDefinition {
  /** Identificador estável (vira `meta.metric` no evento). */
  key: string;
  /** Descrição humana curta. */
  label: string;
  /** Se subir é ruim (abandono/erros) ou se cair é ruim (conclusão). */
  direction: Direction;
  /**
   * Tamanho mínimo de denominador na janela ATUAL para considerar.
   * Evita disparo por amostra ruidosa (ex.: 2 sessões → 50% abandono).
   */
  minSampleCurrent: number;
  /**
   * Tamanho mínimo no BASELINE para considerar comparação válida.
   * Sem baseline suficiente, o detector se cala (não dispara falso positivo).
   */
  minSampleBaseline: number;
  /**
   * Thresholds de variação ABSOLUTA em pontos percentuais (0..1).
   * Ex.: medium=0.10 → 10pp acima do baseline.
   * Para `lower_is_worse`, a comparação é simétrica (queda em pp).
   */
  thresholds: { medium: number; high: number; critical: number };
}

/**
 * Catálogo canônico das 15 métricas pedidas pela auditoria.
 * Os valores numéricos (numerador/denominador) são responsabilidade do caller
 * (RPC SQL) — aqui apenas declaramos NOMES + REGRAS DE ALERTA.
 */
export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  abandon_rate:                 { key: 'abandon_rate',                 label: 'Taxa de abandono por fase',          direction: 'higher_is_worse', minSampleCurrent: 20, minSampleBaseline: 100, thresholds: { medium: 0.10, high: 0.20, critical: 0.40 } },
  refresh_rate:                 { key: 'refresh_rate',                 label: 'Taxa de refresh por fase',           direction: 'higher_is_worse', minSampleCurrent: 30, minSampleBaseline: 150, thresholds: { medium: 0.08, high: 0.15, critical: 0.30 } },
  recovery_local_rate:          { key: 'recovery_local_rate',          label: 'Recovery local aceito',              direction: 'lower_is_worse',  minSampleCurrent: 10, minSampleBaseline: 50,  thresholds: { medium: 0.10, high: 0.20, critical: 0.35 } },
  recovery_remote_rate:         { key: 'recovery_remote_rate',         label: 'Recovery remoto aceito',             direction: 'lower_is_worse',  minSampleCurrent: 10, minSampleBaseline: 50,  thresholds: { medium: 0.10, high: 0.20, critical: 0.35 } },
  recovery_discarded_rate:      { key: 'recovery_discarded_rate',      label: 'Recovery descartado (corruption)',   direction: 'higher_is_worse', minSampleCurrent: 5,  minSampleBaseline: 30,  thresholds: { medium: 0.05, high: 0.10, critical: 0.20 } },
  validation_failed_rate:       { key: 'validation_failed_rate',       label: 'Validation failed',                  direction: 'higher_is_worse', minSampleCurrent: 30, minSampleBaseline: 150, thresholds: { medium: 0.08, high: 0.15, critical: 0.30 } },
  concurrent_tab_rate:          { key: 'concurrent_tab_rate',          label: 'Concurrent tab detected',            direction: 'higher_is_worse', minSampleCurrent: 20, minSampleBaseline: 100, thresholds: { medium: 0.05, high: 0.10, critical: 0.20 } },
  autosave_remote_failed_rate:  { key: 'autosave_remote_failed_rate',  label: 'Autosave remoto falhado',            direction: 'higher_is_worse', minSampleCurrent: 30, minSampleBaseline: 150, thresholds: { medium: 0.05, high: 0.10, critical: 0.20 } },
  avg_phase_duration_ms:        { key: 'avg_phase_duration_ms',        label: 'Tempo médio por fase (ms)',          direction: 'higher_is_worse', minSampleCurrent: 30, minSampleBaseline: 150, thresholds: { medium: 0.30, high: 0.60, critical: 1.00 } },
  avg_total_duration_ms:        { key: 'avg_total_duration_ms',        label: 'Tempo total até conclusão (ms)',     direction: 'higher_is_worse', minSampleCurrent: 10, minSampleBaseline: 50,  thresholds: { medium: 0.30, high: 0.60, critical: 1.00 } },
  completion_rate:              { key: 'completion_rate',              label: 'Taxa de conclusão',                  direction: 'lower_is_worse',  minSampleCurrent: 20, minSampleBaseline: 100, thresholds: { medium: 0.08, high: 0.15, critical: 0.30 } },
  first_service_persist_rate:   { key: 'first_service_persist_rate',   label: 'Persistência do 1º serviço',         direction: 'lower_is_worse',  minSampleCurrent: 15, minSampleBaseline: 75,  thresholds: { medium: 0.05, high: 0.10, critical: 0.20 } },
  retry_remote_rate:            { key: 'retry_remote_rate',            label: 'Retry remoto',                       direction: 'higher_is_worse', minSampleCurrent: 30, minSampleBaseline: 150, thresholds: { medium: 0.10, high: 0.20, critical: 0.40 } },
  corruption_discard_rate:      { key: 'corruption_discard_rate',      label: 'Discard por corruption',             direction: 'higher_is_worse', minSampleCurrent: 5,  minSampleBaseline: 30,  thresholds: { medium: 0.03, high: 0.07, critical: 0.15 } },
  invalid_hydration_rate:       { key: 'invalid_hydration_rate',       label: 'Hidratação inválida',                direction: 'higher_is_worse', minSampleCurrent: 5,  minSampleBaseline: 30,  thresholds: { medium: 0.03, high: 0.07, critical: 0.15 } },
};

/** Snapshot de medição de uma métrica em uma janela. */
export interface MetricSample {
  /** Valor da métrica (rate em 0..1 para taxas, ou número absoluto para durações). */
  value: number;
  /** Tamanho do denominador (sessões/eventos avaliados). Usado para min-sample. */
  sample: number;
}

/** Entrada para classificação de uma única métrica. */
export interface ClassifyInput {
  metric: MetricDefinition;
  current: MetricSample;
  baseline: MetricSample;
}

/** Resultado de classificação — `null` quando nada a alertar. */
export interface ClassifyResult {
  severity: Severity | null;
  /**
   * Para taxas: delta em pontos percentuais (current - baseline).
   * Para durações: delta relativo ((current - baseline) / baseline).
   * Sempre POSITIVO quando há regressão (mesmo em `lower_is_worse`).
   */
  delta: number;
  /** Motivo da não classificação, quando severity === null. */
  reason?: 'insufficient_current' | 'insufficient_baseline' | 'within_tolerance' | 'improved';
}

/**
 * Classifica uma métrica isolada. Pura. Determinística.
 *
 * Regra de comparação:
 *  - higher_is_worse: regressão quando `current.value - baseline.value > threshold`
 *  - lower_is_worse:  regressão quando `baseline.value - current.value > threshold`
 *
 * Para durações (`avg_*`), o threshold é interpretado como crescimento RELATIVO
 * (ex.: 0.30 = 30% mais lento que o baseline), porque pp não faz sentido em ms.
 */
export function classifyMetric(input: ClassifyInput): ClassifyResult {
  const { metric, current, baseline } = input;

  if (current.sample < metric.minSampleCurrent) {
    return { severity: null, delta: 0, reason: 'insufficient_current' };
  }
  if (baseline.sample < metric.minSampleBaseline) {
    return { severity: null, delta: 0, reason: 'insufficient_baseline' };
  }

  const isDuration = metric.key.startsWith('avg_');
  let delta: number;
  if (isDuration) {
    // delta relativo; protege divisão por zero
    const denom = baseline.value > 0 ? baseline.value : 1;
    delta = (current.value - baseline.value) / denom;
    if (metric.direction === 'lower_is_worse') delta = -delta;
  } else {
    delta = metric.direction === 'higher_is_worse'
      ? current.value - baseline.value
      : baseline.value - current.value;
  }

  if (delta <= 0) return { severity: null, delta, reason: 'improved' };

  const t = metric.thresholds;
  let severity: Severity | null = null;
  if (delta >= t.critical) severity = 'critical';
  else if (delta >= t.high) severity = 'high';
  else if (delta >= t.medium) severity = 'medium';
  // 'low' é reservado para variação ABAIXO de medium mas acima de uma fração
  // mínima — usamos 50% do medium como piso para "low" (informativo).
  else if (delta >= t.medium * 0.5) severity = 'low';

  if (!severity) return { severity: null, delta, reason: 'within_tolerance' };
  return { severity, delta };
}

/** Anomalia já classificada e pronta para virar evento. */
export interface RegressionAnomaly {
  metric: string;
  severity: Severity;
  delta: number;
  current: number;
  baseline: number;
  sample_current: number;
  sample_baseline: number;
  /** Fase relacionada quando aplicável (abandon/refresh/duration). */
  phase?: string | null;
  /** App version onde a anomalia foi detectada. */
  app_version?: string | null;
  /** Canal de release (preview/production/dev). */
  release_channel?: string | null;
}

export interface DetectInput {
  /** Métricas medidas na janela atual. Chave = MetricDefinition.key. */
  current: Record<string, MetricSample>;
  /** Métricas medidas no baseline. Chave = MetricDefinition.key. */
  baseline: Record<string, MetricSample>;
  /**
   * Anomalias já emitidas recentemente (para debounce).
   * O detector NÃO consulta banco; o caller passa o que já foi visto na
   * janela de debounce (ex.: últimas 6h).
   */
  recentlyEmitted?: Array<{ metric: string; severity: Severity }>;
  /** Dimensões opcionais para anexar a cada anomalia gerada. */
  context?: { phase?: string | null; app_version?: string | null; release_channel?: string | null };
  /** Override do catálogo (testes). Default: METRIC_DEFINITIONS. */
  catalog?: Record<string, MetricDefinition>;
}

/**
 * Detecta regressões em lote.
 *
 * Debounce:
 *  - Se a mesma `(metric, severity)` já foi emitida na janela informada por
 *    `recentlyEmitted`, suprime. Severidade que ESCALONOU (medium→high) NÃO
 *    é suprimida — re-emite porque é informação nova.
 *
 * Falso-positivo:
 *  - min-sample já blinda no `classifyMetric`.
 *  - Aqui suprimimos também métricas sem `current[key]` ou `baseline[key]`.
 */
export function detectRegressions(input: DetectInput): RegressionAnomaly[] {
  const catalog = input.catalog || METRIC_DEFINITIONS;
  const recent = new Map<string, Severity>();
  for (const r of input.recentlyEmitted || []) recent.set(r.metric, r.severity);

  const severityRank: Record<Severity, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  const out: RegressionAnomaly[] = [];

  for (const def of Object.values(catalog)) {
    const cur = input.current[def.key];
    const base = input.baseline[def.key];
    if (!cur || !base) continue;
    const r = classifyMetric({ metric: def, current: cur, baseline: base });
    if (!r.severity) continue;
    // Debounce: já emitida com severidade igual ou MAIOR → suprime.
    const previous = recent.get(def.key);
    if (previous && severityRank[previous] >= severityRank[r.severity]) continue;
    out.push({
      metric: def.key,
      severity: r.severity,
      delta: r.delta,
      current: cur.value,
      baseline: base.value,
      sample_current: cur.sample,
      sample_baseline: base.sample,
      phase: input.context?.phase ?? null,
      app_version: input.context?.app_version ?? null,
      release_channel: input.context?.release_channel ?? null,
    });
  }
  return out;
}

/**
 * Onboarding Behavioral Funnel Intelligence · funções puras
 *
 * Mede comportamento (NUNCA conteúdo). Toda função aqui é deterministica,
 * sem rede, sem efeitos colaterais — testável em isolamento e reusável tanto
 * pelo cliente (telemetria) quanto pelo agregador admin.
 *
 * Princípios:
 *  - SEM gravar texto digitado, senha, documento ou PII.
 *  - SEM session replay.
 *  - Apenas timing + frequência + sequência de eventos.
 */

// ---------------------------------------------------------------------------
// Tipos / catálogo de eventos comportamentais
// ---------------------------------------------------------------------------

export const BEHAVIORAL_EVENTS = [
  'field_focus',
  'field_blur',
  'field_time_spent',
  'repeated_validation_error',
  'back_button_usage',
  'idle_pause',
  'hesitation_detected',
  'rage_click_detected',
  'rapid_phase_return',
  'form_revisit',
  'multi_attempt_submit',
  'scroll_depth',
  'phase_reentry',
  'incomplete_exit',
] as const;
export type BehavioralEvent = (typeof BEHAVIORAL_EVENTS)[number];

export interface BehavioralMeta {
  phase?: string;
  field?: string; // nome do campo (ex: 'whatsapp', 'cep') — NUNCA o valor
  ms?: number;
  attempts?: number;
  count?: number;
  device?: 'mobile' | 'desktop' | 'tablet' | string;
  source?: string;
  release?: string;
  browser?: string;
  [k: string]: unknown;
}

// ---------------------------------------------------------------------------
// Anti-leak — sanitização defensiva
// ---------------------------------------------------------------------------

/** Chaves PROIBIDAS em meta de evento comportamental (caso o chamador erre). */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /(^|_)(value|text|input|content|raw|payload|body)$/i,
  /(password|senha|token|secret|api_key|apikey)/i,
  /(cpf|cnpj|rg|tax_id|document|doc_number)/i,
  /(email|whatsapp|phone|telefone|celular)$/i,
  /(address|street|logradouro|cep|zip)/i,
  /(name|nome|first_name|last_name|full_name)$/i,
];

const SAFE_FIELD_NAMES = new Set([
  'whatsapp', 'email', 'cpf', 'cnpj', 'cep', 'name', 'phone', 'address',
  'street', 'city', 'state', 'neighborhood', 'birthdate', 'description',
  'category', 'service', 'price', 'avatar', 'photo',
]);

/**
 * Remove qualquer chave que pareça carregar conteúdo sensível.
 * Para a chave `field`, apenas o NOME do campo é permitido (whitelist).
 */
export function sanitizeBehavioralMeta(meta: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!meta || typeof meta !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(meta)) {
    // `field` é especial: aceita só identificador, nunca o valor.
    if (key === 'field') {
      if (typeof val === 'string' && SAFE_FIELD_NAMES.has(val.toLowerCase())) {
        out.field = val.toLowerCase();
      }
      continue;
    }
    if (SENSITIVE_KEY_PATTERNS.some((rx) => rx.test(key))) continue;
    if (typeof val === 'string' && val.length > 120) continue; // protege contra blob
    out[key] = val;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Detectores comportamentais (puros)
// ---------------------------------------------------------------------------

export const BEHAVIORAL_THRESHOLDS = {
  HESITATION_MS: 8_000,       // sem progresso por 8s
  IDLE_PAUSE_MS: 30_000,      // pausa total >30s
  RAGE_CLICK_WINDOW_MS: 1_000,
  RAGE_CLICK_MIN: 3,
  REPEATED_VALIDATION_MIN: 3,
  RAPID_RETURN_MS: 4_000,     // voltou em <4s
  MULTI_SUBMIT_WINDOW_MS: 5_000,
  MULTI_SUBMIT_MIN: 3,
  FIELD_TIME_SLOW_MS: 20_000, // campo lento
} as const;

export function detectHesitation(timeOnFieldMs: number): boolean {
  return timeOnFieldMs >= BEHAVIORAL_THRESHOLDS.HESITATION_MS;
}

export function detectIdlePause(idleMs: number): boolean {
  return idleMs >= BEHAVIORAL_THRESHOLDS.IDLE_PAUSE_MS;
}

/** Rage click: >= N cliques na mesma região em janela curta. */
export function detectRageClick(clickTimestamps: number[]): boolean {
  if (clickTimestamps.length < BEHAVIORAL_THRESHOLDS.RAGE_CLICK_MIN) return false;
  const sorted = [...clickTimestamps].sort((a, b) => a - b);
  const span = sorted[sorted.length - 1] - sorted[0];
  return span <= BEHAVIORAL_THRESHOLDS.RAGE_CLICK_WINDOW_MS;
}

export function detectRepeatedValidationError(attemptsOnSameField: number): boolean {
  return attemptsOnSameField >= BEHAVIORAL_THRESHOLDS.REPEATED_VALIDATION_MIN;
}

export function detectRapidPhaseReturn(forwardAtMs: number, backAtMs: number): boolean {
  const dt = backAtMs - forwardAtMs;
  return dt >= 0 && dt <= BEHAVIORAL_THRESHOLDS.RAPID_RETURN_MS;
}

export function detectMultiAttemptSubmit(submitTimestamps: number[]): boolean {
  if (submitTimestamps.length < BEHAVIORAL_THRESHOLDS.MULTI_SUBMIT_MIN) return false;
  const sorted = [...submitTimestamps].sort((a, b) => a - b);
  const span = sorted[sorted.length - 1] - sorted[0];
  return span <= BEHAVIORAL_THRESHOLDS.MULTI_SUBMIT_WINDOW_MS;
}

// ---------------------------------------------------------------------------
// Throttle (memória local, não interfere em runtime principal)
// ---------------------------------------------------------------------------

export interface ThrottleState {
  lastSentAt: Record<string, number>;
}

export function createThrottleState(): ThrottleState {
  return { lastSentAt: {} };
}

/**
 * Retorna true se o evento DEVE ser enviado agora (e atualiza o estado).
 * Throttle escopado por chave (event:field:phase).
 */
export function shouldEmitBehavioral(
  state: ThrottleState,
  key: string,
  nowMs: number,
  minIntervalMs = 2_000,
): boolean {
  if (!(key in state.lastSentAt)) {
    state.lastSentAt[key] = nowMs;
    return true;
  }
  const last = state.lastSentAt[key];
  if (nowMs - last < minIntervalMs) return false;
  state.lastSentAt[key] = nowMs;
  return true;
}

// ---------------------------------------------------------------------------
// Friction score
// ---------------------------------------------------------------------------

export interface FrictionInputs {
  enters: number;
  abandons: number;
  refreshes: number;
  hesitations: number;
  rage_clicks: number;
  repeated_validations: number;
  back_buttons: number;
  multi_submits: number;
  avg_time_ms: number; // médio por fase
}

export interface FrictionResult {
  score: number; // 0 baixo atrito · 100 atrito máximo
  level: 'low' | 'medium' | 'high' | 'critical';
  drivers: Array<{ code: string; weight: number }>;
}

/**
 * Score 0..100 baseado em ratios normalizados por entradas.
 * Heurística operacional (sem ML).
 */
export function computeFrictionScore(i: FrictionInputs): FrictionResult {
  const enters = Math.max(1, i.enters);
  const drivers: Array<{ code: string; weight: number }> = [];
  let score = 0;

  const abandonRate = i.abandons / enters;
  const refreshRate = i.refreshes / enters;
  const hesitationRate = i.hesitations / enters;
  const rageRate = i.rage_clicks / enters;
  const repeatedRate = i.repeated_validations / enters;
  const backRate = i.back_buttons / enters;
  const submitRate = i.multi_submits / enters;

  const add = (code: string, value: number, weight: number) => {
    const contrib = Math.min(weight, Math.round(value * weight * 100) / 100);
    if (contrib > 0) {
      drivers.push({ code, weight: contrib });
      score += contrib;
    }
  };

  add('abandon', abandonRate, 30);
  add('hesitation', hesitationRate, 15);
  add('rage', rageRate, 15);
  add('repeated_validation', repeatedRate, 15);
  add('multi_submit', submitRate, 10);
  add('back_button', backRate, 5);
  add('refresh', refreshRate, 5);

  // Penalidade por tempo médio elevado (cap em 5)
  if (i.avg_time_ms > BEHAVIORAL_THRESHOLDS.FIELD_TIME_SLOW_MS) {
    const overshoot = Math.min(1, (i.avg_time_ms - BEHAVIORAL_THRESHOLDS.FIELD_TIME_SLOW_MS) / 40_000);
    const contrib = Math.round(overshoot * 5 * 100) / 100;
    if (contrib > 0) {
      drivers.push({ code: 'slow_time', weight: contrib });
      score += contrib;
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level =
    score >= 70 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';

  drivers.sort((a, b) => b.weight - a.weight);
  return { score, level, drivers };
}

// ---------------------------------------------------------------------------
// Hotspot ranking
// ---------------------------------------------------------------------------

export interface HotspotItem {
  key: string;          // phase ou field
  enters: number;
  abandons: number;
  hesitations: number;
  rage_clicks: number;
  repeated_validations: number;
  refreshes?: number;
  multi_submits?: number;
  avg_time_ms?: number;
}

export interface RankedHotspot extends HotspotItem {
  friction: FrictionResult;
}

export function rankHotspots(items: HotspotItem[], minEnters = 5): RankedHotspot[] {
  return items
    .filter((it) => it.enters >= minEnters)
    .map((it) => ({
      ...it,
      friction: computeFrictionScore({
        enters: it.enters,
        abandons: it.abandons,
        refreshes: it.refreshes ?? 0,
        hesitations: it.hesitations,
        rage_clicks: it.rage_clicks,
        repeated_validations: it.repeated_validations,
        back_buttons: 0,
        multi_submits: it.multi_submits ?? 0,
        avg_time_ms: it.avg_time_ms ?? 0,
      }),
    }))
    .sort((a, b) => b.friction.score - a.friction.score);
}

// ---------------------------------------------------------------------------
// Abandonment chain parsing
// ---------------------------------------------------------------------------

export interface SessionEvent {
  session_id: string;
  event: string;
  created_at: string | Date;
  meta?: { phase?: string; [k: string]: unknown };
}

export interface AbandonmentChain {
  session_id: string;
  exit_phase: string | null;
  last_3: string[];          // últimos 3 eventos antes do abandono
  duration_ms: number | null;
}

/**
 * Para cada sessão, identifica a sequência final se NÃO houve `complete`.
 * Retorna até 3 eventos antes do abandono, útil para padrões top-K.
 */
export function parseAbandonmentChains(events: SessionEvent[]): AbandonmentChain[] {
  const bySession = new Map<string, SessionEvent[]>();
  for (const e of events) {
    const arr = bySession.get(e.session_id) ?? [];
    arr.push(e);
    bySession.set(e.session_id, arr);
  }
  const out: AbandonmentChain[] = [];
  for (const [sid, arr] of bySession) {
    arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const completed = arr.some((e) => e.event === 'complete');
    if (completed) continue;
    const last3 = arr.slice(-3).map((e) => e.event);
    const exit = [...arr].reverse().find((e) => e.meta?.phase)?.meta?.phase ?? null;
    const duration =
      arr.length >= 2
        ? new Date(arr[arr.length - 1].created_at).getTime() -
          new Date(arr[0].created_at).getTime()
        : null;
    out.push({ session_id: sid, exit_phase: exit ?? null, last_3: last3, duration_ms: duration });
  }
  return out;
}

/** Conta padrões mais comuns de saída — top K. */
export function topAbandonmentPatterns(
  chains: AbandonmentChain[],
  topK = 5,
): Array<{ pattern: string; count: number }> {
  const counter = new Map<string, number>();
  for (const c of chains) {
    const key = `${c.exit_phase ?? '?'} ⇠ ${c.last_3.join(' → ')}`;
    counter.set(key, (counter.get(key) ?? 0) + 1);
  }
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([pattern, count]) => ({ pattern, count }));
}

// ---------------------------------------------------------------------------
// Segmentação
// ---------------------------------------------------------------------------

export interface SegmentBreakdown {
  segment: string;
  enters: number;
  completes: number;
  abandons: number;
  completion_rate: number;
  friction_score: number;
}

export function aggregateBySegment(
  events: Array<{ event: string; meta?: Record<string, unknown> }>,
  by: 'device' | 'source' | 'release' | 'browser',
): SegmentBreakdown[] {
  const groups = new Map<string, { enters: number; completes: number; abandons: number; hesitations: number; rage: number; repeated: number; refreshes: number }>();
  for (const e of events) {
    const seg = String(e.meta?.[by] ?? 'unknown');
    const g = groups.get(seg) ?? { enters: 0, completes: 0, abandons: 0, hesitations: 0, rage: 0, repeated: 0, refreshes: 0 };
    if (e.event === 'enter') g.enters++;
    else if (e.event === 'complete') g.completes++;
    else if (e.event === 'abandon') g.abandons++;
    else if (e.event === 'hesitation_detected') g.hesitations++;
    else if (e.event === 'rage_click_detected') g.rage++;
    else if (e.event === 'repeated_validation_error') g.repeated++;
    else if (e.event === 'refresh') g.refreshes++;
    groups.set(seg, g);
  }
  const out: SegmentBreakdown[] = [];
  for (const [seg, g] of groups) {
    const rate = g.enters > 0 ? Math.round((g.completes / g.enters) * 100) : 0;
    const f = computeFrictionScore({
      enters: g.enters,
      abandons: g.abandons,
      refreshes: g.refreshes,
      hesitations: g.hesitations,
      rage_clicks: g.rage,
      repeated_validations: g.repeated,
      back_buttons: 0,
      multi_submits: 0,
      avg_time_ms: 0,
    });
    out.push({
      segment: seg,
      enters: g.enters,
      completes: g.completes,
      abandons: g.abandons,
      completion_rate: rate,
      friction_score: f.score,
    });
  }
  return out.sort((a, b) => b.enters - a.enters);
}

// ---------------------------------------------------------------------------
// UX Impact simulation (heurística simples)
// ---------------------------------------------------------------------------

export interface UxImpactInput {
  current_completion_rate: number; // 0..100
  current_friction_score: number;  // 0..100
  friction_reduction_pct: number;  // ex: 30 = reduzir 30% do atrito
}

export interface UxImpactResult {
  estimated_completion_rate: number;
  estimated_lift_pp: number;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * Heurística: para cada 10pp de atrito removido, estimar até 4pp de ganho em
 * completion (cap pelo gap até 100%). Confiança baseada na magnitude da
 * mudança e no nível atual de atrito.
 */
export function simulateUxImpact(i: UxImpactInput): UxImpactResult {
  const friction = Math.max(0, Math.min(100, i.current_friction_score));
  const reductionPct = Math.max(0, Math.min(100, i.friction_reduction_pct));
  const frictionRemoved = (friction * reductionPct) / 100; // pontos absolutos
  const liftRaw = (frictionRemoved / 10) * 4;              // 4pp por 10pp atrito
  const gap = Math.max(0, 100 - i.current_completion_rate);
  const lift = Math.min(gap, Math.round(liftRaw * 100) / 100);
  const newRate = Math.max(0, Math.min(100, Math.round((i.current_completion_rate + lift) * 100) / 100));
  const confidence: UxImpactResult['confidence'] =
    friction < 25 ? 'low' : reductionPct >= 50 && friction >= 50 ? 'high' : 'medium';
  return {
    estimated_completion_rate: newRate,
    estimated_lift_pp: lift,
    confidence,
  };
}

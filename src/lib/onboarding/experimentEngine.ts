/**
 * Onboarding Experimentation Framework · engine puro
 *
 * Responsabilidades:
 *  - atribuição determinística de variantes (anti-flicker)
 *  - audience filter (device/source/release/region/userType)
 *  - safety guard (lista branca de tipos seguros)
 *  - cálculo de delta vs baseline por variante
 *  - kill switch heurístico (degradação acima de threshold)
 *
 * NÃO contém side effects, NÃO fala com supabase, NÃO altera onboarding.
 * Toda a I/O fica nas RPCs (admin_*) e no consumidor (admin page / hook opt-in).
 */

// ---------- types ---------------------------------------------------------

export type SafeExperimentType =
  | 'copy'
  | 'label'
  | 'helper_text'
  | 'cta_wording'
  | 'progress_indicator'
  | 'visual_order'
  | 'spacing_layout'
  | 'microinteraction';

export const SAFE_EXPERIMENT_TYPES: ReadonlyArray<SafeExperimentType> = [
  'copy',
  'label',
  'helper_text',
  'cta_wording',
  'progress_indicator',
  'visual_order',
  'spacing_layout',
  'microinteraction',
];

/** Tipos PROIBIDOS nesta fase — nunca podem virar experimento. */
export const FORBIDDEN_EXPERIMENT_TYPES = [
  'persistence',
  'reducer',
  'hydration',
  'autosave',
  'recovery',
  'validation_core',
  'feature_flag_critical',
] as const;

export type ExperimentStatus =
  | 'draft'
  | 'running'
  | 'paused'
  | 'auto_disabled'
  | 'completed';

export interface ExperimentVariant {
  id: string;
  label?: string;
  weight?: number; // default 1
  isControl?: boolean;
  payload?: Record<string, unknown>;
}

export interface ExperimentAudience {
  device?: 'mobile' | 'desktop' | 'any';
  sources?: string[];
  releases?: string[];
  regions?: string[];
  userType?: 'new' | 'returning' | 'any';
}

export interface ExperimentDefinition {
  id: string;
  type: SafeExperimentType;
  status: ExperimentStatus;
  rolloutPercentage: number; // 0..100
  variants: ExperimentVariant[];
  audience?: ExperimentAudience;
  startAt?: string | null;
  endAt?: string | null;
}

export interface AssignmentContext {
  unitId: string; // user_id || session_id
  device?: 'mobile' | 'desktop';
  source?: string | null;
  release?: string | null;
  region?: string | null;
  userType?: 'new' | 'returning';
  now?: Date;
}

export interface AssignmentResult {
  experimentId: string;
  variantId: string | null; // null = não elegível / fora do rollout
  reason:
    | 'assigned'
    | 'rollout_excluded'
    | 'audience_excluded'
    | 'not_running'
    | 'expired'
    | 'not_started'
    | 'no_variants';
}

// ---------- hash determinístico (FNV-1a 32-bit) --------------------------

/** FNV-1a 32-bit. Determinístico, sem dependências, estável entre browsers. */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime: 16777619
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Bucket 0..9999 estável por (experimentId, unitId). */
export function bucketFor(experimentId: string, unitId: string): number {
  return fnv1a32(`${experimentId}::${unitId}`) % 10000;
}

// ---------- audience filter ----------------------------------------------

export function matchesAudience(
  audience: ExperimentAudience | undefined,
  ctx: AssignmentContext,
): boolean {
  if (!audience) return true;
  if (audience.device && audience.device !== 'any' && ctx.device && audience.device !== ctx.device) {
    return false;
  }
  if (audience.sources?.length && ctx.source && !audience.sources.includes(ctx.source)) {
    return false;
  }
  if (audience.releases?.length && ctx.release && !audience.releases.includes(ctx.release)) {
    return false;
  }
  if (audience.regions?.length && ctx.region && !audience.regions.includes(ctx.region)) {
    return false;
  }
  if (audience.userType && audience.userType !== 'any' && ctx.userType && audience.userType !== ctx.userType) {
    return false;
  }
  return true;
}

// ---------- weighted variant pick ----------------------------------------

export function pickVariant(
  variants: ExperimentVariant[],
  bucket: number,
): ExperimentVariant | null {
  if (!variants.length) return null;
  const weights = variants.map(v => Math.max(0, v.weight ?? 1));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return variants[0] ?? null;
  // bucket 0..9999 → posição 0..total
  const pos = (bucket / 10000) * total;
  let acc = 0;
  for (let i = 0; i < variants.length; i++) {
    acc += weights[i];
    if (pos < acc) return variants[i];
  }
  return variants[variants.length - 1];
}

// ---------- main assign --------------------------------------------------

export function assignVariant(
  exp: ExperimentDefinition,
  ctx: AssignmentContext,
): AssignmentResult {
  const now = ctx.now ?? new Date();
  if (exp.status !== 'running') {
    return { experimentId: exp.id, variantId: null, reason: 'not_running' };
  }
  if (exp.startAt && new Date(exp.startAt) > now) {
    return { experimentId: exp.id, variantId: null, reason: 'not_started' };
  }
  if (exp.endAt && new Date(exp.endAt) < now) {
    return { experimentId: exp.id, variantId: null, reason: 'expired' };
  }
  if (!exp.variants?.length) {
    return { experimentId: exp.id, variantId: null, reason: 'no_variants' };
  }
  if (!matchesAudience(exp.audience, ctx)) {
    return { experimentId: exp.id, variantId: null, reason: 'audience_excluded' };
  }
  const bucket = bucketFor(exp.id, ctx.unitId);
  const rolloutCutoff = Math.max(0, Math.min(100, exp.rolloutPercentage)) * 100;
  if (bucket >= rolloutCutoff) {
    return { experimentId: exp.id, variantId: null, reason: 'rollout_excluded' };
  }
  const variant = pickVariant(exp.variants, bucket);
  return { experimentId: exp.id, variantId: variant?.id ?? null, reason: 'assigned' };
}

// ---------- safety guard -------------------------------------------------

export interface SafetyValidation {
  ok: boolean;
  errors: string[];
}

export function validateExperimentDefinition(exp: Partial<ExperimentDefinition>): SafetyValidation {
  const errors: string[] = [];
  if (!exp.id || !/^[a-z0-9][a-z0-9_-]{2,63}$/.test(exp.id)) {
    errors.push('id_invalid');
  }
  if (!exp.type || !SAFE_EXPERIMENT_TYPES.includes(exp.type as SafeExperimentType)) {
    errors.push('type_not_in_safe_whitelist');
  }
  if ((FORBIDDEN_EXPERIMENT_TYPES as readonly string[]).includes(String(exp.type))) {
    errors.push('type_forbidden');
  }
  if (exp.rolloutPercentage == null || exp.rolloutPercentage < 0 || exp.rolloutPercentage > 100) {
    errors.push('rollout_out_of_range');
  }
  if (!exp.variants || exp.variants.length < 2) {
    errors.push('variants_min_2');
  }
  if (exp.variants && exp.variants.length > 6) {
    errors.push('variants_max_6');
  }
  if (exp.variants && !exp.variants.some(v => v.isControl)) {
    errors.push('control_required');
  }
  return { ok: errors.length === 0, errors };
}

// ---------- metrics & delta ----------------------------------------------

export interface VariantMetrics {
  variantId: string;
  unitsAssigned: number;
  enters: number;
  completes: number;
  abandons: number;
  refreshes: number;
  recoveries: number;
  validationFailed: number;
  rageClicks: number;
  hesitations: number;
  avgPhaseDurationMs: number;
}

export interface VariantDelta {
  variantId: string;
  completionRatePp: number; // pontos percentuais vs control
  abandonRatePp: number;
  refreshRatePp: number;
  recoveryRatePp: number;
  validationFailedDeltaPct: number; // delta relativo
  status: 'winning' | 'losing' | 'neutral' | 'inconclusive';
  confidence: 'low' | 'medium' | 'high';
}

export const MIN_UNITS_FOR_CONFIDENCE = 100;

function rate(num: number, den: number): number {
  if (!den || den <= 0) return 0;
  return num / den;
}

export function computeVariantDelta(
  variant: VariantMetrics,
  control: VariantMetrics,
): VariantDelta {
  const completionPp =
    (rate(variant.completes, variant.enters) - rate(control.completes, control.enters)) * 100;
  const abandonPp =
    (rate(variant.abandons, variant.enters) - rate(control.abandons, control.enters)) * 100;
  const refreshPp =
    (rate(variant.refreshes, variant.enters) - rate(control.refreshes, control.enters)) * 100;
  const recoveryPp =
    (rate(variant.recoveries, variant.enters) - rate(control.recoveries, control.enters)) * 100;
  const valDeltaPct = control.validationFailed > 0
    ? ((variant.validationFailed - control.validationFailed) / control.validationFailed) * 100
    : (variant.validationFailed > 0 ? 100 : 0);

  const minUnits = Math.min(variant.unitsAssigned, control.unitsAssigned);
  const confidence: VariantDelta['confidence'] =
    minUnits >= MIN_UNITS_FOR_CONFIDENCE * 5
      ? 'high'
      : minUnits >= MIN_UNITS_FOR_CONFIDENCE
      ? 'medium'
      : 'low';

  let status: VariantDelta['status'] = 'neutral';
  if (confidence === 'low') {
    status = 'inconclusive';
  } else if (completionPp >= 2 && abandonPp <= 0) {
    status = 'winning';
  } else if (completionPp <= -2 || abandonPp >= 5) {
    status = 'losing';
  }

  return {
    variantId: variant.variantId,
    completionRatePp: Math.round(completionPp * 100) / 100,
    abandonRatePp: Math.round(abandonPp * 100) / 100,
    refreshRatePp: Math.round(refreshPp * 100) / 100,
    recoveryRatePp: Math.round(recoveryPp * 100) / 100,
    validationFailedDeltaPct: Math.round(valDeltaPct * 100) / 100,
    status,
    confidence,
  };
}

// ---------- kill switch --------------------------------------------------

export const KILL_SWITCH_THRESHOLDS = {
  /** Queda de completion (pp) vs control que dispara auto-disable. */
  COMPLETION_DROP_PP: 15,
  /** Aumento de abandon (pp) vs control que dispara auto-disable. */
  ABANDON_RISE_PP: 15,
  /** Aumento relativo de validation failures vs control (%). */
  VALIDATION_RISE_PCT: 50,
  /** Aumento de refresh rate (pp) vs control. */
  REFRESH_RISE_PP: 20,
  /** Aumento de recovery rate (pp) vs control. */
  RECOVERY_RISE_PP: 20,
  /** Mínimo de unidades por variante antes de considerar kill. */
  MIN_UNITS: 200,
} as const;

export interface KillSwitchDecision {
  shouldDisable: boolean;
  reasons: string[];
  variantId: string;
}

export function evaluateKillSwitch(
  variant: VariantMetrics,
  control: VariantMetrics,
): KillSwitchDecision {
  const reasons: string[] = [];
  if (variant.unitsAssigned < KILL_SWITCH_THRESHOLDS.MIN_UNITS) {
    return { shouldDisable: false, reasons: ['insufficient_units'], variantId: variant.variantId };
  }
  const d = computeVariantDelta(variant, control);
  if (d.completionRatePp <= -KILL_SWITCH_THRESHOLDS.COMPLETION_DROP_PP) {
    reasons.push('completion_collapse');
  }
  if (d.abandonRatePp >= KILL_SWITCH_THRESHOLDS.ABANDON_RISE_PP) {
    reasons.push('abandonment_spike');
  }
  if (d.validationFailedDeltaPct >= KILL_SWITCH_THRESHOLDS.VALIDATION_RISE_PCT) {
    reasons.push('validation_explosion');
  }
  if (d.refreshRatePp >= KILL_SWITCH_THRESHOLDS.REFRESH_RISE_PP) {
    reasons.push('refresh_spike');
  }
  if (d.recoveryRatePp >= KILL_SWITCH_THRESHOLDS.RECOVERY_RISE_PP) {
    reasons.push('recovery_degradation');
  }
  return {
    shouldDisable: reasons.length > 0,
    reasons,
    variantId: variant.variantId,
  };
}

// ---------- snapshot diff (baseline vs after) ----------------------------

export interface ExperimentSnapshot {
  capturedAt: string;
  rolloutReached: number;
  variants: VariantMetrics[];
}

export interface SnapshotDelta {
  variantId: string;
  enters: number;
  completes: number;
  abandons: number;
  completionRatePp: number;
}

export function diffSnapshots(
  before: ExperimentSnapshot,
  after: ExperimentSnapshot,
): SnapshotDelta[] {
  const byIdBefore = new Map(before.variants.map(v => [v.variantId, v]));
  return after.variants.map(a => {
    const b = byIdBefore.get(a.variantId);
    const beforeRate = b ? rate(b.completes, b.enters) : 0;
    const afterRate = rate(a.completes, a.enters);
    return {
      variantId: a.variantId,
      enters: a.enters - (b?.enters ?? 0),
      completes: a.completes - (b?.completes ?? 0),
      abandons: a.abandons - (b?.abandons ?? 0),
      completionRatePp: Math.round((afterRate - beforeRate) * 10000) / 100,
    };
  });
}

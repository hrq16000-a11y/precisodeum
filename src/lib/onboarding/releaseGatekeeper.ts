/**
 * Onboarding Release Gatekeeper · funções puras
 *
 * Replica em TS a lógica de `compute_onboarding_release_health` (SQL) para
 * permitir testes determinísticos sem rede e consumir snapshots já calculados
 * pelo servidor.
 *
 * NÃO faz rollback. NÃO deployd. Apenas: avalia, classifica, compara, sinaliza.
 */

export type ReleaseClassification = 'SAFE' | 'WARNING' | 'DEGRADED' | 'BLOCKED';
export type ReleaseStage = 'canary' | 'staging' | 'production';

export interface ReleaseHealthInputs {
  enters: number;
  completes: number;
  abandons: number;
  refreshes: number;
  autosave_fail: number;
  recovery_corruption: number;
  validation_fail: number;
  zombie_timer: number;
  open_regressions: number;
  critical_regressions: number;
  open_incidents: number;
}

export interface ReleaseBlockReason {
  code: string;
  value: number;
}

export interface ReleaseHealthResult {
  health_score: number;
  classification: ReleaseClassification;
  blocked: boolean;
  block_reasons: ReleaseBlockReason[];
  completion_rate: number;
  abandon_rate: number;
  refresh_rate: number;
}

/** Thresholds operacionais — espelha o SQL. */
export const RELEASE_THRESHOLDS = {
  MIN_SAMPLE_ENTERS: 20,
  COMPLETION_COLLAPSE: 40, // %
  COMPLETION_LOW: 60,
  ABANDON_HIGH: 50,
  AUTOSAVE_FAIL_WARN: 10,
  AUTOSAVE_FAIL_BLOCK: 25,
  RECOVERY_CORRUPTION_BLOCK: 3,
  REGRESSIONS_WARN: 3,
  ZOMBIE_TIMER_WARN: 5,
  SCORE_BLOCKED_BELOW: 50,
  SCORE_DEGRADED_BELOW: 70,
  SCORE_WARNING_BELOW: 85,
} as const;

export function classifyHealth(score: number, blocked: boolean): ReleaseClassification {
  if (blocked || score < RELEASE_THRESHOLDS.SCORE_BLOCKED_BELOW) return 'BLOCKED';
  if (score < RELEASE_THRESHOLDS.SCORE_DEGRADED_BELOW) return 'DEGRADED';
  if (score < RELEASE_THRESHOLDS.SCORE_WARNING_BELOW) return 'WARNING';
  return 'SAFE';
}

export function computeHealthScore(inputs: ReleaseHealthInputs): ReleaseHealthResult {
  const i = inputs;
  let score = 100;
  let blocked = false;
  const reasons: ReleaseBlockReason[] = [];

  const completion_rate = i.enters > 0 ? round((i.completes / i.enters) * 100) : 0;
  const abandon_rate = i.enters > 0 ? round((i.abandons / i.enters) * 100) : 0;
  const refresh_rate = i.enters > 0 ? round((i.refreshes / i.enters) * 100) : 0;

  if (i.enters >= RELEASE_THRESHOLDS.MIN_SAMPLE_ENTERS) {
    if (completion_rate < RELEASE_THRESHOLDS.COMPLETION_COLLAPSE) {
      score -= 35;
      reasons.push({ code: 'completion_collapse', value: completion_rate });
      blocked = true;
    } else if (completion_rate < RELEASE_THRESHOLDS.COMPLETION_LOW) {
      score -= 15;
      reasons.push({ code: 'completion_low', value: completion_rate });
    }
    if (abandon_rate > RELEASE_THRESHOLDS.ABANDON_HIGH) {
      score -= 15;
      reasons.push({ code: 'abandon_high', value: abandon_rate });
    }
  }

  if (i.autosave_fail >= RELEASE_THRESHOLDS.AUTOSAVE_FAIL_WARN) {
    score -= 20;
    reasons.push({ code: 'autosave_fail_spike', value: i.autosave_fail });
    if (i.autosave_fail >= RELEASE_THRESHOLDS.AUTOSAVE_FAIL_BLOCK) blocked = true;
  }

  if (i.recovery_corruption >= RELEASE_THRESHOLDS.RECOVERY_CORRUPTION_BLOCK) {
    score -= 25;
    reasons.push({ code: 'recovery_corruption', value: i.recovery_corruption });
    blocked = true;
  }

  if (i.critical_regressions > 0) {
    score -= 25;
    reasons.push({ code: 'critical_regressions_open', value: i.critical_regressions });
    blocked = true;
  } else if (i.open_regressions >= RELEASE_THRESHOLDS.REGRESSIONS_WARN) {
    score -= 10;
    reasons.push({ code: 'regressions_open', value: i.open_regressions });
  }

  if (i.open_incidents > 0) {
    score -= 15;
    reasons.push({ code: 'incident_open', value: i.open_incidents });
    blocked = true;
  }

  if (i.zombie_timer >= RELEASE_THRESHOLDS.ZOMBIE_TIMER_WARN) {
    score -= 5;
    reasons.push({ code: 'zombie_timer', value: i.zombie_timer });
  }

  score = Math.max(0, Math.min(100, score));
  const classification = classifyHealth(score, blocked);
  blocked = blocked || classification === 'BLOCKED';

  return {
    health_score: score,
    classification,
    blocked,
    block_reasons: reasons,
    completion_rate,
    abandon_rate,
    refresh_rate,
  };
}

export interface SnapshotLike {
  id?: string;
  health_score: number;
  classification: ReleaseClassification;
  open_regressions: number;
  critical_regressions: number;
  open_incidents: number;
  metrics: {
    completion_rate?: number;
    abandon_rate?: number;
    autosave_fail?: number;
    recovery_corruption?: number;
    [k: string]: unknown;
  };
}

export interface SnapshotDelta {
  health_score: number;
  open_regressions: number;
  critical_regressions: number;
  open_incidents: number;
  completion_rate: number;
  abandon_rate: number;
  autosave_fail: number;
  recovery_corruption: number;
}

export function compareSnapshots(baseline: SnapshotLike, candidate: SnapshotLike): SnapshotDelta {
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  return {
    health_score: candidate.health_score - baseline.health_score,
    open_regressions: candidate.open_regressions - baseline.open_regressions,
    critical_regressions: candidate.critical_regressions - baseline.critical_regressions,
    open_incidents: candidate.open_incidents - baseline.open_incidents,
    completion_rate:
      num(candidate.metrics.completion_rate) - num(baseline.metrics.completion_rate),
    abandon_rate: num(candidate.metrics.abandon_rate) - num(baseline.metrics.abandon_rate),
    autosave_fail: num(candidate.metrics.autosave_fail) - num(baseline.metrics.autosave_fail),
    recovery_corruption:
      num(candidate.metrics.recovery_corruption) - num(baseline.metrics.recovery_corruption),
  };
}

export type CanaryVerdict =
  | { kind: 'safe' }
  | { kind: 'warning'; reasons: string[] }
  | { kind: 'degraded'; reasons: string[] }
  | { kind: 'blocked'; reasons: string[] };

/**
 * Compara canary vs baseline (produção atual). Emite veredicto operacional
 * sem rollback automático — apenas sinaliza.
 */
export function detectCanaryDegradation(
  baseline: SnapshotLike,
  canary: SnapshotLike,
): CanaryVerdict {
  const d = compareSnapshots(baseline, canary);
  const reasons: string[] = [];
  let blocked = canary.classification === 'BLOCKED';
  let degraded = false;
  let warning = false;

  if (d.health_score <= -20) {
    reasons.push(`health_score_drop:${d.health_score}`);
    blocked = true;
  } else if (d.health_score <= -10) {
    reasons.push(`health_score_drop:${d.health_score}`);
    degraded = true;
  } else if (d.health_score <= -5) {
    reasons.push(`health_score_drop:${d.health_score}`);
    warning = true;
  }

  if (d.completion_rate <= -15) {
    reasons.push(`completion_rate_drop:${d.completion_rate}`);
    blocked = true;
  } else if (d.completion_rate <= -8) {
    reasons.push(`completion_rate_drop:${d.completion_rate}`);
    degraded = true;
  }

  if (d.critical_regressions > 0) {
    reasons.push(`critical_regressions:+${d.critical_regressions}`);
    blocked = true;
  }
  if (d.open_incidents > 0) {
    reasons.push(`incidents:+${d.open_incidents}`);
    blocked = true;
  }
  if (d.recovery_corruption >= 3) {
    reasons.push(`recovery_corruption:+${d.recovery_corruption}`);
    blocked = true;
  }
  if (d.autosave_fail >= 15) {
    reasons.push(`autosave_fail:+${d.autosave_fail}`);
    degraded = true;
  }

  if (blocked) return { kind: 'blocked', reasons };
  if (degraded) return { kind: 'degraded', reasons };
  if (warning || reasons.length > 0) return { kind: 'warning', reasons };
  return { kind: 'safe' };
}

/** Severity de escalação para emissão de eventos (release_blocked/degraded/incident). */
export function escalationEventName(verdict: CanaryVerdict): string | null {
  switch (verdict.kind) {
    case 'blocked':
      return 'release_blocked';
    case 'degraded':
      return 'release_degraded';
    case 'warning':
      return 'release_warning';
    default:
      return null;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

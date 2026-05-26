/**
 * Operational Memory + Causal Knowledge Layer (READ-ONLY)
 *
 * Engine PURA, determinística, sem IO, sem mutação, sem IA, sem embeddings,
 * sem ML, sem vector DB. Acumula conhecimento operacional histórico a partir
 * de incidentes já produzidos pelas outras camadas (regression watch,
 * operational reality, runtime governance, evidence correlation, executive
 * layer) e devolve:
 *
 *   - fingerprints determinísticos (FNV-1a 32-bit)
 *   - classificação por família heurística
 *   - similaridade histórica (Jaccard sobre traços)
 *   - recorrência / hotspots crônicos / release instability
 *   - mitigation effectiveness
 *   - reputation/stability/reliability scores 0–100
 *   - timeline histórica + knowledge graph + summaries determinísticos
 *
 * Política (frozen):
 *   - read-only / no-mutation / no-IO / no-AI / no-PII / no-raw-payload
 *   - todas as inferências têm low-sample guard (MIN_SAMPLE)
 */

// ============================================================================
// POLICY
// ============================================================================

export const OPERATIONAL_MEMORY_POLICY = Object.freeze({
  read_only: true,
  allow_mutation: false,
  allow_ai: false,
  allow_embeddings: false,
  allow_vector_db: false,
  allow_auto_fix: false,
  allow_auto_rollback: false,
  allow_pii_capture: false,
  allow_raw_payload: false,
});

export const MIN_SAMPLE_FOR_INFERENCE = 3;
export const MIN_SAMPLE_FOR_TREND = 5;
export const RECURRENCE_WINDOW_DAYS_DEFAULT = 30;

// ============================================================================
// TYPES — Input contracts (reaproveitam saídas das outras camadas)
// ============================================================================

export type IncidentDetectorKind =
  | 'phantom_success'
  | 'partial_persistence'
  | 'zombie_draft'
  | 'hidden_loop'
  | 'retry_storm'
  | 'dead_navigation'
  | 'toast_vs_reality'
  | 'ui_vs_backend_divergence'
  | 'impossible_state'
  | 'session_fragmentation'
  | 'recovery_integrity_failure'
  | 'persistence_failure'
  | 'completion_collapse'
  | 'autosave_failure'
  | 'corruption'
  | 'release_regression'
  | 'behavioral_friction';

export type FailureFamily =
  | 'hydration_family'
  | 'persistence_family'
  | 'navigation_family'
  | 'recovery_family'
  | 'release_family'
  | 'behavioral_family'
  | 'synchronization_family'
  | 'telemetry_family'
  | 'integrity_family';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface HistoricalIncident {
  /** ID opaco do incidente (já hashado upstream). */
  id: string;
  /** Detector que produziu o incidente. */
  detector: IncidentDetectorKind;
  /** Fase em que ocorreu, se aplicável. */
  phase?: string | null;
  /** Transição (from->to) quando aplicável. */
  transition?: string | null;
  /** Padrão de retry (`none|low|medium|storm`). */
  retry_pattern?: 'none' | 'low' | 'medium' | 'storm';
  /** Padrão de recovery (`none|used|discarded|corrupted`). */
  recovery_pattern?: 'none' | 'used' | 'discarded' | 'corrupted';
  /** Versão do app no momento. */
  release?: string | null;
  /** Classe do device (`mobile|desktop|unknown`). */
  device_class?: 'mobile' | 'desktop' | 'unknown';
  /** Bucket temporal grosso (fast<500ms / medium<3s / slow<15s / very_slow). */
  timing_bucket?: 'fast' | 'medium' | 'slow' | 'very_slow';
  severity: Severity;
  /** Cadeia compacta de divergências observadas (tokens canônicos). */
  divergence_chain?: readonly string[];
  /** Timestamp ISO. */
  occurred_at: string;
  /** Identificador opaco de mitigação aplicada antes/depois (se conhecido). */
  mitigation_id?: string | null;
}

export interface MitigationRecord {
  id: string;
  applied_at: string;
  /** Famílias-alvo da mitigação. */
  targets: readonly FailureFamily[];
  /** Detector-alvo opcional. */
  detector?: IncidentDetectorKind;
  /** Releases em que ficou ativa (`from` inclusivo, `to` opcional). */
  active_releases?: readonly string[];
}

// ============================================================================
// FNV-1a 32-bit — fingerprint determinístico (sem libs)
// ============================================================================

function fnv1a32(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ============================================================================
// FINGERPRINTS + FAMILY
// ============================================================================

export interface IncidentFingerprint {
  hash: string;
  family: FailureFamily;
  signature: string;
}

const FAMILY_BY_DETECTOR: Record<IncidentDetectorKind, FailureFamily> = {
  phantom_success: 'integrity_family',
  partial_persistence: 'persistence_family',
  zombie_draft: 'recovery_family',
  hidden_loop: 'navigation_family',
  retry_storm: 'navigation_family',
  dead_navigation: 'navigation_family',
  toast_vs_reality: 'synchronization_family',
  ui_vs_backend_divergence: 'synchronization_family',
  impossible_state: 'integrity_family',
  session_fragmentation: 'synchronization_family',
  recovery_integrity_failure: 'recovery_family',
  persistence_failure: 'persistence_family',
  completion_collapse: 'integrity_family',
  autosave_failure: 'persistence_family',
  corruption: 'integrity_family',
  release_regression: 'release_family',
  behavioral_friction: 'behavioral_family',
};

/** Classifica o detector em uma família heurística determinística. */
export function classifyFailureFamily(detector: IncidentDetectorKind): FailureFamily {
  return FAMILY_BY_DETECTOR[detector];
}

/**
 * Fingerprint estável (FNV-1a 32-bit) cobrindo:
 * detector · phase · transition · retry · recovery · device · timing · severity
 * · divergence_chain ordenada. NÃO inclui release (deve permitir match entre
 * releases para detectar reincidência cross-release).
 */
export function buildIncidentFingerprint(inc: HistoricalIncident): IncidentFingerprint {
  const parts = [
    `d=${inc.detector}`,
    `p=${inc.phase ?? '_'}`,
    `t=${inc.transition ?? '_'}`,
    `r=${inc.retry_pattern ?? 'none'}`,
    `c=${inc.recovery_pattern ?? 'none'}`,
    `dev=${inc.device_class ?? 'unknown'}`,
    `ti=${inc.timing_bucket ?? 'medium'}`,
    `sev=${inc.severity}`,
    `chain=${[...(inc.divergence_chain ?? [])].sort().join('|')}`,
  ];
  const signature = parts.join('::');
  return {
    hash: fnv1a32(signature),
    family: classifyFailureFamily(inc.detector),
    signature,
  };
}

// ============================================================================
// HISTORICAL SIMILARITY (Jaccard sobre traços do fingerprint)
// ============================================================================

function traits(inc: HistoricalIncident): Set<string> {
  return new Set([
    `det:${inc.detector}`,
    `fam:${classifyFailureFamily(inc.detector)}`,
    `phase:${inc.phase ?? '_'}`,
    `trans:${inc.transition ?? '_'}`,
    `retry:${inc.retry_pattern ?? 'none'}`,
    `rec:${inc.recovery_pattern ?? 'none'}`,
    `dev:${inc.device_class ?? 'unknown'}`,
    `sev:${inc.severity}`,
    ...(inc.divergence_chain ?? []).map((d) => `div:${d}`),
  ]);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const v of a) if (b.has(v)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface SimilarIncident {
  id: string;
  similarity: number;
  family: FailureFamily;
  detector: IncidentDetectorKind;
  occurred_at: string;
}

/** Top-N incidentes históricos mais parecidos com `target` (Jaccard ≥ minSim). */
export function correlateHistoricalIncidents(
  target: HistoricalIncident,
  history: readonly HistoricalIncident[],
  opts: { topN?: number; minSim?: number } = {},
): SimilarIncident[] {
  const topN = opts.topN ?? 10;
  const minSim = opts.minSim ?? 0.5;
  const ta = traits(target);
  return [...history]
    .filter((h) => h.id !== target.id)
    .map((h) => ({
      id: h.id,
      detector: h.detector,
      family: classifyFailureFamily(h.detector),
      occurred_at: h.occurred_at,
      similarity: jaccard(ta, traits(h)),
    }))
    .filter((x) => x.similarity >= minSim)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);
}

export function detectHistoricalRegressionSimilarity(
  target: HistoricalIncident,
  history: readonly HistoricalIncident[],
  minSim = 0.7,
): boolean {
  const sims = correlateHistoricalIncidents(target, history, { topN: 5, minSim });
  return sims.length >= MIN_SAMPLE_FOR_INFERENCE;
}

// ============================================================================
// RECURRENCE + HOTSPOTS + DRIFT
// ============================================================================

export interface RecurringPattern {
  fingerprint: string;
  family: FailureFamily;
  count: number;
  first_seen: string;
  last_seen: string;
  affected_releases: string[];
  affected_phases: string[];
}

export function detectRecurringPatterns(
  history: readonly HistoricalIncident[],
  opts: { minCount?: number; windowDays?: number; now?: number } = {},
): RecurringPattern[] {
  const minCount = opts.minCount ?? MIN_SAMPLE_FOR_INFERENCE;
  const windowDays = opts.windowDays ?? RECURRENCE_WINDOW_DAYS_DEFAULT;
  const now = opts.now ?? Date.now();
  const cutoff = now - windowDays * 86_400_000;

  const buckets = new Map<string, HistoricalIncident[]>();
  for (const inc of history) {
    const ts = new Date(inc.occurred_at).getTime();
    if (Number.isFinite(ts) && ts < cutoff) continue;
    const fp = buildIncidentFingerprint(inc).hash;
    const arr = buckets.get(fp) ?? [];
    arr.push(inc);
    buckets.set(fp, arr);
  }

  const out: RecurringPattern[] = [];
  for (const [fp, arr] of buckets) {
    if (arr.length < minCount) continue;
    const sorted = [...arr].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    const releases = Array.from(new Set(sorted.map((x) => x.release).filter((x): x is string => !!x))).sort();
    const phases = Array.from(new Set(sorted.map((x) => x.phase).filter((x): x is string => !!x))).sort();
    out.push({
      fingerprint: fp,
      family: classifyFailureFamily(sorted[0].detector),
      count: arr.length,
      first_seen: sorted[0].occurred_at,
      last_seen: sorted.at(-1)!.occurred_at,
      affected_releases: releases,
      affected_phases: phases,
    });
  }
  return out.sort((a, b) => b.count - a.count);
}

export interface ChronicHotspot {
  phase: string;
  count: number;
  ratio_vs_global: number;
  families: FailureFamily[];
}

/**
 * Hotspot crônico = fase com taxa de incidentes ≥ 2x a média global.
 * Low-sample guard: ignora fases com <MIN_SAMPLE_FOR_INFERENCE incidentes.
 */
export function detectChronicHotspots(
  history: readonly HistoricalIncident[],
  opts: { multiplier?: number } = {},
): ChronicHotspot[] {
  const multiplier = opts.multiplier ?? 2;
  if (history.length < MIN_SAMPLE_FOR_INFERENCE) return [];
  const byPhase = new Map<string, HistoricalIncident[]>();
  for (const inc of history) {
    if (!inc.phase) continue;
    const arr = byPhase.get(inc.phase) ?? [];
    arr.push(inc);
    byPhase.set(inc.phase, arr);
  }
  const phases = [...byPhase.keys()];
  if (!phases.length) return [];
  const avg = history.length / Math.max(1, phases.length);

  const out: ChronicHotspot[] = [];
  for (const [phase, arr] of byPhase) {
    if (arr.length < MIN_SAMPLE_FOR_INFERENCE) continue;
    const ratio = arr.length / avg;
    if (ratio >= multiplier) {
      out.push({
        phase,
        count: arr.length,
        ratio_vs_global: Math.round(ratio * 100) / 100,
        families: Array.from(new Set(arr.map((x) => classifyFailureFamily(x.detector)))).sort(),
      });
    }
  }
  return out.sort((a, b) => b.count - a.count);
}

export interface ReleaseInstability {
  release: string;
  incidents: number;
  ratio_vs_avg: number;
  families: FailureFamily[];
  blast_radius_score: number;
}

export function detectReleaseInstability(
  history: readonly HistoricalIncident[],
  opts: { multiplier?: number } = {},
): ReleaseInstability[] {
  const multiplier = opts.multiplier ?? 1.75;
  const byRel = new Map<string, HistoricalIncident[]>();
  for (const inc of history) {
    if (!inc.release) continue;
    const arr = byRel.get(inc.release) ?? [];
    arr.push(inc);
    byRel.set(inc.release, arr);
  }
  if (byRel.size < 2) return [];
  const avg = history.length / byRel.size;
  const out: ReleaseInstability[] = [];
  for (const [release, arr] of byRel) {
    if (arr.length < MIN_SAMPLE_FOR_INFERENCE) continue;
    const ratio = arr.length / avg;
    if (ratio < multiplier) continue;
    const blast = computeBlastRadiusForIncidents(arr);
    out.push({
      release,
      incidents: arr.length,
      ratio_vs_avg: Math.round(ratio * 100) / 100,
      families: Array.from(new Set(arr.map((x) => classifyFailureFamily(x.detector)))).sort(),
      blast_radius_score: blast,
    });
  }
  return out.sort((a, b) => b.ratio_vs_avg - a.ratio_vs_avg);
}

// Blast radius heurístico: severidade ponderada × diversidade de fases/famílias.
function computeBlastRadiusForIncidents(arr: readonly HistoricalIncident[]): number {
  const sevW: Record<Severity, number> = { low: 1, medium: 3, high: 7, critical: 12 };
  const sevSum = arr.reduce((s, i) => s + sevW[i.severity], 0);
  const phases = new Set(arr.map((i) => i.phase).filter(Boolean));
  const families = new Set(arr.map((i) => classifyFailureFamily(i.detector)));
  return Math.round(sevSum * (1 + phases.size * 0.05 + families.size * 0.1));
}

export interface BlastRadiusPoint {
  release: string;
  blast: number;
  incidents: number;
}

export function computeBlastRadiusHistory(history: readonly HistoricalIncident[]): BlastRadiusPoint[] {
  const byRel = new Map<string, HistoricalIncident[]>();
  for (const inc of history) {
    if (!inc.release) continue;
    const arr = byRel.get(inc.release) ?? [];
    arr.push(inc);
    byRel.set(inc.release, arr);
  }
  return [...byRel.entries()]
    .map(([release, arr]) => ({ release, blast: computeBlastRadiusForIncidents(arr), incidents: arr.length }))
    .sort((a, b) => a.release.localeCompare(b.release));
}

// ============================================================================
// MITIGATION EFFECTIVENESS
// ============================================================================

export interface MitigationEffectiveness {
  mitigation_id: string;
  family?: FailureFamily;
  incidents_before: number;
  incidents_after: number;
  reduction_pct: number; // -100..100 (positivo = reduziu)
  enough_sample: boolean;
}

/**
 * Compara janelas de mesma duração antes/depois do `applied_at` da mitigação,
 * filtrando por família ou detector se informado.
 */
export function detectMitigationEffectiveness(
  history: readonly HistoricalIncident[],
  mitigation: MitigationRecord,
  opts: { windowDays?: number } = {},
): MitigationEffectiveness {
  const windowDays = opts.windowDays ?? 14;
  const t = new Date(mitigation.applied_at).getTime();
  const start = t - windowDays * 86_400_000;
  const end = t + windowDays * 86_400_000;

  const inWindow = (iso: string) => {
    const ts = new Date(iso).getTime();
    return ts >= start && ts <= end;
  };
  const matchesTarget = (inc: HistoricalIncident) => {
    if (mitigation.detector && inc.detector !== mitigation.detector) return false;
    if (mitigation.targets.length && !mitigation.targets.includes(classifyFailureFamily(inc.detector))) return false;
    return true;
  };

  let before = 0;
  let after = 0;
  for (const inc of history) {
    if (!matchesTarget(inc) || !inWindow(inc.occurred_at)) continue;
    const ts = new Date(inc.occurred_at).getTime();
    if (ts < t) before++;
    else after++;
  }
  const enough = before + after >= MIN_SAMPLE_FOR_INFERENCE;
  const reduction = before === 0 ? (after === 0 ? 0 : -100) : Math.round(((before - after) / before) * 100);
  return {
    mitigation_id: mitigation.id,
    family: mitigation.targets[0],
    incidents_before: before,
    incidents_after: after,
    reduction_pct: enough ? reduction : 0,
    enough_sample: enough,
  };
}

// ============================================================================
// DRIFTS + DECAYS
// ============================================================================

/**
 * Operational pattern drift: compara distribuição por família entre 2 janelas
 * (recent vs baseline) e calcula L1 distance / 2 (0..1).
 */
export function detectOperationalPatternDrift(
  history: readonly HistoricalIncident[],
  opts: { recentDays?: number; baselineDays?: number; now?: number; minSamples?: number } = {},
): { drift: number; enough_sample: boolean; recent_dist: Record<string, number>; baseline_dist: Record<string, number> } {
  const recentDays = opts.recentDays ?? 14;
  const baselineDays = opts.baselineDays ?? 30;
  const now = opts.now ?? Date.now();
  const minSamples = opts.minSamples ?? MIN_SAMPLE_FOR_TREND;
  const recentCut = now - recentDays * 86_400_000;
  const baselineCut = now - (recentDays + baselineDays) * 86_400_000;

  const recent: HistoricalIncident[] = [];
  const baseline: HistoricalIncident[] = [];
  for (const inc of history) {
    const ts = new Date(inc.occurred_at).getTime();
    if (!Number.isFinite(ts)) continue;
    if (ts >= recentCut) recent.push(inc);
    else if (ts >= baselineCut) baseline.push(inc);
  }
  if (recent.length < minSamples || baseline.length < minSamples) {
    return { drift: 0, enough_sample: false, recent_dist: {}, baseline_dist: {} };
  }
  const dist = (arr: HistoricalIncident[]) => {
    const m: Record<string, number> = {};
    for (const i of arr) {
      const f = classifyFailureFamily(i.detector);
      m[f] = (m[f] ?? 0) + 1;
    }
    for (const k of Object.keys(m)) m[k] = m[k] / arr.length;
    return m;
  };
  const r = dist(recent);
  const b = dist(baseline);
  const keys = new Set([...Object.keys(r), ...Object.keys(b)]);
  let l1 = 0;
  for (const k of keys) l1 += Math.abs((r[k] ?? 0) - (b[k] ?? 0));
  return { drift: Math.round((l1 / 2) * 100) / 100, enough_sample: true, recent_dist: r, baseline_dist: b };
}

export function detectStabilityDecay(history: readonly HistoricalIncident[], opts: { windowDays?: number; now?: number } = {}): {
  decaying: boolean;
  recent_per_day: number;
  baseline_per_day: number;
} {
  const windowDays = opts.windowDays ?? 7;
  const now = opts.now ?? Date.now();
  const recentCut = now - windowDays * 86_400_000;
  const baselineCut = now - 3 * windowDays * 86_400_000;

  let recent = 0;
  let baseline = 0;
  for (const inc of history) {
    const ts = new Date(inc.occurred_at).getTime();
    if (!Number.isFinite(ts)) continue;
    if (ts >= recentCut) recent++;
    else if (ts >= baselineCut) baseline++;
  }
  const recentPerDay = recent / windowDays;
  const baselinePerDay = baseline / (2 * windowDays);
  return {
    decaying: recent + baseline >= MIN_SAMPLE_FOR_TREND && recentPerDay > baselinePerDay * 1.5,
    recent_per_day: Math.round(recentPerDay * 100) / 100,
    baseline_per_day: Math.round(baselinePerDay * 100) / 100,
  };
}

export function detectTrustDecay(
  history: readonly HistoricalIncident[],
  opts: { windowDays?: number } = {},
): { trust_score: number; degraded: boolean } {
  const stab = detectStabilityDecay(history, { windowDays: opts.windowDays });
  const decay = stab.decaying ? Math.min(50, Math.round((stab.recent_per_day - stab.baseline_per_day) * 10)) : 0;
  const trust = Math.max(0, 100 - decay);
  return { trust_score: trust, degraded: stab.decaying };
}

export function detectConfidenceEvolution(
  history: readonly HistoricalIncident[],
  opts: { bucketDays?: number; now?: number; buckets?: number } = {},
): { bucket: string; incidents: number; confidence: number }[] {
  const bucketDays = opts.bucketDays ?? 7;
  const bucketsN = opts.buckets ?? 4;
  const now = opts.now ?? Date.now();
  const out: { bucket: string; incidents: number; confidence: number }[] = [];
  for (let i = bucketsN - 1; i >= 0; i--) {
    const end = now - i * bucketDays * 86_400_000;
    const start = end - bucketDays * 86_400_000;
    const inWindow = history.filter((h) => {
      const ts = new Date(h.occurred_at).getTime();
      return Number.isFinite(ts) && ts >= start && ts < end;
    });
    const sevW: Record<Severity, number> = { low: 1, medium: 2, high: 4, critical: 8 };
    const sevTotal = inWindow.reduce((s, i2) => s + sevW[i2.severity], 0);
    const confidence = Math.max(0, 100 - Math.min(100, sevTotal * 3));
    out.push({ bucket: new Date(start).toISOString().slice(0, 10), incidents: inWindow.length, confidence });
  }
  return out;
}

// ============================================================================
// LINEAGE + REPUTATION + SCORES
// ============================================================================

export function detectPersistenceFailureLineage(history: readonly HistoricalIncident[]): string[] {
  return collectLineageByFamily(history, 'persistence_family');
}
export function detectRecoveryFailureLineage(history: readonly HistoricalIncident[]): string[] {
  return collectLineageByFamily(history, 'recovery_family');
}
export function detectKnownBrokenFlows(history: readonly HistoricalIncident[]): { phase: string; family: FailureFamily; count: number }[] {
  const map = new Map<string, { phase: string; family: FailureFamily; count: number }>();
  for (const inc of history) {
    if (!inc.phase) continue;
    if (inc.severity !== 'high' && inc.severity !== 'critical') continue;
    const fam = classifyFailureFamily(inc.detector);
    const k = `${inc.phase}::${fam}`;
    const prev = map.get(k) ?? { phase: inc.phase, family: fam, count: 0 };
    prev.count++;
    map.set(k, prev);
  }
  return [...map.values()].filter((x) => x.count >= MIN_SAMPLE_FOR_INFERENCE).sort((a, b) => b.count - a.count);
}

function collectLineageByFamily(history: readonly HistoricalIncident[], family: FailureFamily): string[] {
  return history
    .filter((h) => classifyFailureFamily(h.detector) === family)
    .map((h) => h.id);
}

function clamp(n: number, lo = 0, hi = 100): number { return Math.max(lo, Math.min(hi, n)); }

const SEV_PENALTY: Record<Severity, number> = { low: 1, medium: 3, high: 7, critical: 12 };

export function computeOperationalReputation(history: readonly HistoricalIncident[]): number {
  if (!history.length) return 100;
  const penalty = history.reduce((s, i) => s + SEV_PENALTY[i.severity], 0);
  return clamp(100 - Math.min(100, penalty));
}

export function computePhaseReliabilityHistory(history: readonly HistoricalIncident[]): Record<string, number> {
  const byPhase = new Map<string, HistoricalIncident[]>();
  for (const inc of history) {
    if (!inc.phase) continue;
    const arr = byPhase.get(inc.phase) ?? [];
    arr.push(inc);
    byPhase.set(inc.phase, arr);
  }
  const out: Record<string, number> = {};
  for (const [phase, arr] of byPhase) {
    const penalty = arr.reduce((s, i) => s + SEV_PENALTY[i.severity], 0);
    out[phase] = clamp(100 - Math.min(100, penalty));
  }
  return out;
}

export interface RecurrenceProbability {
  fingerprint: string;
  probability: number; // 0..1 (heurístico)
  count: number;
  enough_sample: boolean;
}

/**
 * Probabilidade heurística de reincidência: `1 - 1/(count+1)`, saturando em
 * 0.95. Low-sample guard: <MIN_SAMPLE_FOR_INFERENCE retorna 0/enough=false.
 */
export function computeFailureRecurrenceProbability(history: readonly HistoricalIncident[]): RecurrenceProbability[] {
  const buckets = new Map<string, number>();
  for (const inc of history) {
    const fp = buildIncidentFingerprint(inc).hash;
    buckets.set(fp, (buckets.get(fp) ?? 0) + 1);
  }
  const out: RecurrenceProbability[] = [];
  for (const [fp, count] of buckets) {
    const enough = count >= MIN_SAMPLE_FOR_INFERENCE;
    const probability = enough ? Math.min(0.95, 1 - 1 / (count + 1)) : 0;
    out.push({ fingerprint: fp, probability: Math.round(probability * 100) / 100, count, enough_sample: enough });
  }
  return out.sort((a, b) => b.probability - a.probability);
}

export function computeRuntimeStabilityTrend(history: readonly HistoricalIncident[], opts: { now?: number } = {}): {
  trend: 'improving' | 'flat' | 'degrading' | 'insufficient';
  delta_per_day: number;
} {
  const stab = detectStabilityDecay(history, { windowDays: 7, now: opts.now });
  if (stab.recent_per_day === 0 && stab.baseline_per_day === 0) {
    return { trend: 'insufficient', delta_per_day: 0 };
  }
  const delta = Math.round((stab.recent_per_day - stab.baseline_per_day) * 100) / 100;
  if (Math.abs(delta) < 0.5) return { trend: 'flat', delta_per_day: delta };
  return { trend: delta > 0 ? 'degrading' : 'improving', delta_per_day: delta };
}

export interface MemoryScores {
  operational_reputation: number;
  runtime_stability: number;
  phase_reliability_avg: number;
  recovery_reliability: number;
  persistence_reliability: number;
  telemetry_confidence: number;
  forensic_confidence: number;
  release_stability: number;
  mitigation_effectiveness_avg: number;
}

export function computeMemoryScores(
  history: readonly HistoricalIncident[],
  mitigations: readonly MitigationRecord[] = [],
): MemoryScores {
  const rep = computeOperationalReputation(history);
  const phaseRel = computePhaseReliabilityHistory(history);
  const phaseVals = Object.values(phaseRel);
  const phaseAvg = phaseVals.length ? Math.round(phaseVals.reduce((a, b) => a + b, 0) / phaseVals.length) : 100;

  const familyScore = (fam: FailureFamily) => {
    const sub = history.filter((h) => classifyFailureFamily(h.detector) === fam);
    return clamp(100 - sub.reduce((s, i) => s + SEV_PENALTY[i.severity], 0));
  };

  const releaseInstabs = detectReleaseInstability(history);
  const releaseStab = clamp(100 - releaseInstabs.reduce((s, r) => s + Math.round((r.ratio_vs_avg - 1) * 20), 0));

  const trust = detectTrustDecay(history).trust_score;

  let mitAvg = 100;
  if (mitigations.length) {
    const eff = mitigations.map((m) => detectMitigationEffectiveness(history, m));
    const ok = eff.filter((e) => e.enough_sample);
    if (ok.length) {
      const avg = ok.reduce((s, e) => s + e.reduction_pct, 0) / ok.length;
      mitAvg = clamp(50 + Math.round(avg / 2));
    }
  }

  return {
    operational_reputation: rep,
    runtime_stability: trust,
    phase_reliability_avg: phaseAvg,
    recovery_reliability: familyScore('recovery_family'),
    persistence_reliability: familyScore('persistence_family'),
    telemetry_confidence: familyScore('telemetry_family'),
    forensic_confidence: familyScore('integrity_family'),
    release_stability: releaseStab,
    mitigation_effectiveness_avg: mitAvg,
  };
}

// ============================================================================
// KNOWLEDGE GRAPH + LINEAGE + TIMELINE
// ============================================================================

export interface KnowledgeNode {
  id: string;
  kind: 'incident' | 'release' | 'detector' | 'phase' | 'mitigation' | 'fingerprint' | 'family' | 'hotspot';
  label: string;
}
export interface KnowledgeEdge {
  from: string;
  to: string;
  kind: 'caused_by' | 'resembles' | 'regressed_after' | 'mitigated_by' | 'worsened_by' | 'recovered_after' | 'correlated_with' | 'historically_similar' | 'recurring_in';
  weight: number;
}
export interface KnowledgeGraph { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }

export function buildKnowledgeGraph(
  history: readonly HistoricalIncident[],
  mitigations: readonly MitigationRecord[] = [],
): KnowledgeGraph {
  const nodes = new Map<string, KnowledgeNode>();
  const edges: KnowledgeEdge[] = [];
  const ensure = (n: KnowledgeNode) => { if (!nodes.has(n.id)) nodes.set(n.id, n); };

  for (const inc of history) {
    const fp = buildIncidentFingerprint(inc);
    ensure({ id: `incident:${inc.id}`, kind: 'incident', label: `${inc.detector}@${inc.phase ?? '_'}` });
    ensure({ id: `fingerprint:${fp.hash}`, kind: 'fingerprint', label: fp.hash });
    ensure({ id: `family:${fp.family}`, kind: 'family', label: fp.family });
    ensure({ id: `detector:${inc.detector}`, kind: 'detector', label: inc.detector });
    edges.push({ from: `incident:${inc.id}`, to: `fingerprint:${fp.hash}`, kind: 'recurring_in', weight: 1 });
    edges.push({ from: `fingerprint:${fp.hash}`, to: `family:${fp.family}`, kind: 'correlated_with', weight: 1 });
    edges.push({ from: `incident:${inc.id}`, to: `detector:${inc.detector}`, kind: 'caused_by', weight: 1 });
    if (inc.release) {
      ensure({ id: `release:${inc.release}`, kind: 'release', label: inc.release });
      edges.push({ from: `incident:${inc.id}`, to: `release:${inc.release}`, kind: 'regressed_after', weight: 1 });
    }
    if (inc.phase) {
      ensure({ id: `phase:${inc.phase}`, kind: 'phase', label: inc.phase });
      edges.push({ from: `incident:${inc.id}`, to: `phase:${inc.phase}`, kind: 'correlated_with', weight: 1 });
    }
    if (inc.mitigation_id) {
      ensure({ id: `mitigation:${inc.mitigation_id}`, kind: 'mitigation', label: inc.mitigation_id });
      edges.push({ from: `incident:${inc.id}`, to: `mitigation:${inc.mitigation_id}`, kind: 'mitigated_by', weight: 1 });
    }
  }
  for (const m of mitigations) {
    ensure({ id: `mitigation:${m.id}`, kind: 'mitigation', label: m.id });
    for (const fam of m.targets) {
      ensure({ id: `family:${fam}`, kind: 'family', label: fam });
      edges.push({ from: `mitigation:${m.id}`, to: `family:${fam}`, kind: 'mitigated_by', weight: 1 });
    }
  }
  for (const hs of detectChronicHotspots(history)) {
    const id = `hotspot:${hs.phase}`;
    ensure({ id, kind: 'hotspot', label: `${hs.phase} ×${hs.count}` });
    edges.push({ from: id, to: `phase:${hs.phase}`, kind: 'recurring_in', weight: hs.count });
  }
  return { nodes: [...nodes.values()], edges };
}

export interface CausalLineageEntry {
  incident_id: string;
  at: string;
  fingerprint: string;
  family: FailureFamily;
  release?: string | null;
  similar_prev?: string[];
}

export function buildCausalLineage(history: readonly HistoricalIncident[]): CausalLineageEntry[] {
  const sorted = [...history].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  return sorted.map((inc, idx) => {
    const fp = buildIncidentFingerprint(inc);
    const prev = sorted.slice(0, idx);
    const sims = correlateHistoricalIncidents(inc, prev, { topN: 3, minSim: 0.7 });
    return {
      incident_id: inc.id,
      at: inc.occurred_at,
      fingerprint: fp.hash,
      family: fp.family,
      release: inc.release ?? null,
      similar_prev: sims.map((s) => s.id),
    };
  });
}

export interface HistoricalTimelinePoint {
  date: string;
  incidents: number;
  severity_score: number;
  families: Partial<Record<FailureFamily, number>>;
}

export function buildHistoricalTimeline(history: readonly HistoricalIncident[]): HistoricalTimelinePoint[] {
  const byDay = new Map<string, HistoricalIncident[]>();
  for (const inc of history) {
    const day = inc.occurred_at.slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(inc);
    byDay.set(day, arr);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, arr]) => {
      const families: Partial<Record<FailureFamily, number>> = {};
      let sev = 0;
      for (const i of arr) {
        const f = classifyFailureFamily(i.detector);
        families[f] = (families[f] ?? 0) + 1;
        sev += SEV_PENALTY[i.severity];
      }
      return { date, incidents: arr.length, severity_score: sev, families };
    });
}

// ============================================================================
// FAILURE MEMORY (per fingerprint, agregada)
// ============================================================================

export interface FailureMemoryEntry {
  fingerprint: string;
  family: FailureFamily;
  detector: IncidentDetectorKind;
  first_seen: string;
  last_seen: string;
  recurrence_count: number;
  affected_releases: string[];
  affected_phases: string[];
  severity_evolution: Severity[];
  blast_radius: number;
}

export function buildFailureMemory(history: readonly HistoricalIncident[]): FailureMemoryEntry[] {
  const buckets = new Map<string, HistoricalIncident[]>();
  for (const inc of history) {
    const fp = buildIncidentFingerprint(inc).hash;
    const arr = buckets.get(fp) ?? [];
    arr.push(inc);
    buckets.set(fp, arr);
  }
  const out: FailureMemoryEntry[] = [];
  for (const [fp, arr] of buckets) {
    const sorted = [...arr].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    out.push({
      fingerprint: fp,
      family: classifyFailureFamily(sorted[0].detector),
      detector: sorted[0].detector,
      first_seen: sorted[0].occurred_at,
      last_seen: sorted.at(-1)!.occurred_at,
      recurrence_count: arr.length,
      affected_releases: Array.from(new Set(arr.map((x) => x.release).filter((x): x is string => !!x))).sort(),
      affected_phases: Array.from(new Set(arr.map((x) => x.phase).filter((x): x is string => !!x))).sort(),
      severity_evolution: sorted.map((x) => x.severity),
      blast_radius: computeBlastRadiusForIncidents(arr),
    });
  }
  return out.sort((a, b) => b.recurrence_count - a.recurrence_count);
}

// ============================================================================
// KNOWLEDGE SUMMARY (templates determinísticos · sem geração livre / sem IA)
// ============================================================================

export interface KnowledgeSummaryLine {
  kind: 'recurrence' | 'hotspot' | 'release' | 'mitigation' | 'drift' | 'decay';
  text: string;
}

export function generateOperationalKnowledgeSummary(
  history: readonly HistoricalIncident[],
  mitigations: readonly MitigationRecord[] = [],
): KnowledgeSummaryLine[] {
  const out: KnowledgeSummaryLine[] = [];
  const recurring = detectRecurringPatterns(history).slice(0, 5);
  for (const r of recurring) {
    out.push({
      kind: 'recurrence',
      text: `Família ${r.family} reapareceu ${r.count} vezes (releases: ${r.affected_releases.join(', ') || '—'}).`,
    });
  }
  for (const h of detectChronicHotspots(history).slice(0, 3)) {
    out.push({
      kind: 'hotspot',
      text: `${h.phase} apresenta recorrência crônica (${h.count} incidentes, ${h.ratio_vs_global}x acima da média).`,
    });
  }
  for (const r of detectReleaseInstability(history).slice(0, 3)) {
    out.push({
      kind: 'release',
      text: `Release ${r.release} acumula ${r.incidents} incidentes (${r.ratio_vs_avg}x acima da média) · blast=${r.blast_radius_score}.`,
    });
  }
  for (const m of mitigations) {
    const eff = detectMitigationEffectiveness(history, m);
    if (!eff.enough_sample) continue;
    if (eff.reduction_pct > 0) {
      out.push({ kind: 'mitigation', text: `Mitigação ${m.id} reduziu reincidência em ${eff.reduction_pct}%.` });
    } else if (eff.reduction_pct < 0) {
      out.push({ kind: 'mitigation', text: `Mitigação ${m.id} NÃO reduziu reincidência (${eff.reduction_pct}%).` });
    }
  }
  const drift = detectOperationalPatternDrift(history);
  if (drift.enough_sample && drift.drift >= 0.2) {
    out.push({ kind: 'drift', text: `Drift operacional detectado: distribuição por família mudou ${Math.round(drift.drift * 100)}% nas últimas semanas.` });
  }
  const decay = detectStabilityDecay(history);
  if (decay.decaying) {
    out.push({ kind: 'decay', text: `Estabilidade em queda: ${decay.recent_per_day}/dia recente vs ${decay.baseline_per_day}/dia baseline.` });
  }
  return out;
}

// ============================================================================
// AGGREGATE REPORT
// ============================================================================

export interface OperationalMemoryReport {
  scores: MemoryScores;
  recurring: RecurringPattern[];
  hotspots: ChronicHotspot[];
  releases: ReleaseInstability[];
  drift: ReturnType<typeof detectOperationalPatternDrift>;
  decay: ReturnType<typeof detectStabilityDecay>;
  trend: ReturnType<typeof computeRuntimeStabilityTrend>;
  blast_history: BlastRadiusPoint[];
  failure_memory: FailureMemoryEntry[];
  timeline: HistoricalTimelinePoint[];
  graph: KnowledgeGraph;
  summary: KnowledgeSummaryLine[];
}

export function buildOperationalMemoryReport(
  history: readonly HistoricalIncident[],
  mitigations: readonly MitigationRecord[] = [],
): OperationalMemoryReport {
  return {
    scores: computeMemoryScores(history, mitigations),
    recurring: detectRecurringPatterns(history),
    hotspots: detectChronicHotspots(history),
    releases: detectReleaseInstability(history),
    drift: detectOperationalPatternDrift(history),
    decay: detectStabilityDecay(history),
    trend: computeRuntimeStabilityTrend(history),
    blast_history: computeBlastRadiusHistory(history),
    failure_memory: buildFailureMemory(history),
    timeline: buildHistoricalTimeline(history),
    graph: buildKnowledgeGraph(history, mitigations),
    summary: generateOperationalKnowledgeSummary(history, mitigations),
  };
}

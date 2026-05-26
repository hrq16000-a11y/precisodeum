/**
 * Operational Reality Layer — Forensic Runtime Reconstruction (READ-ONLY)
 *
 * Engine PURA, determinística, sem side-effects, sem IO, sem mutação.
 * Reconstrói a jornada operacional do usuário no onboarding a partir de
 * eventos já existentes (`onboarding_events`) cruzados com sinais de backend
 * (provider/service/onboarding_completed), correlacionando UI vs DB para
 * detectar:
 *
 *  - Phantom Success    (UI = sucesso, backend = vazio)
 *  - Silent Failure     (toast/success sem persist)
 *  - Partial Persistence (provider sim, service não)
 *  - Zombie Draft       (draft revivido sem integridade)
 *  - Hidden Loop        (alternância patológica entre fases)
 *  - Retry Storm        (rajadas de submit/persist/recovery)
 *  - Dead Navigation    (cliques sem mudança real de fase)
 *  - Toast vs Reality   (toast sem evidência operacional)
 *  - Impossible State   (done sem provider, completion sem persist)
 *  - Session Fragmentation (multi-device/multi-session divergentes)
 *  - Recovery Integrity Failure
 *  - UI vs Backend divergence
 *
 * Saída: timelines, findings, scores 0–100 e um Reality Graph.
 *
 * Política (frozen):
 *  - read-only / no-mutation
 *  - no raw input / no PII / no payload dump
 *  - no AI / no realtime / no auto-fix
 *  - sanitiza meta agressivamente
 */

// ============================================================================
// POLICY (frozen)
// ============================================================================

export const OPERATIONAL_REALITY_POLICY = Object.freeze({
  read_only: true,
  allow_mutation: false,
  allow_auto_fix: false,
  allow_pii_capture: false,
  allow_raw_input_capture: false,
  allow_payload_dump: false,
  allow_ai: false,
  allow_realtime: false,
});

// ============================================================================
// TYPES
// ============================================================================

export type ForensicEventType =
  | 'phase_enter'
  | 'phase_exit'
  | 'next'
  | 'back'
  | 'skip'
  | 'submit'
  | 'persist_ok'
  | 'persist_failed'
  | 'autosave_ok'
  | 'autosave_failed'
  | 'recovery_used'
  | 'recovery_discarded'
  | 'recovery_corrupted'
  | 'validation_failed'
  | 'refresh'
  | 'abandonment_suspected'
  | 'toast_success'
  | 'toast_error'
  | 'completion'
  | 'celebration'
  | 'navigation'
  | 'concurrent_tab_detected'
  | 'unknown';

export interface ForensicEvent {
  /** Identificador único do evento. */
  id: string;
  /** ISO timestamp. */
  created_at: string;
  /** Identificador da sessão (anônimo, hash). */
  session_id?: string | null;
  /** Identificador do usuário (anônimo, hash). */
  user_id?: string | null;
  /** Fase do wizard onde o evento ocorreu. */
  phase?: string | null;
  /** Nome canônico do evento (já no domínio onboarding). */
  event: string;
  /** Meta sanitizado (sem PII / sem raw input). */
  meta?: Record<string, unknown> | null;
  /** Versão do app no momento do evento. */
  app_version?: string | null;
  /** Identificador opaco do device (hash). */
  device_id?: string | null;
}

export interface BackendTruth {
  /** Existe provider real (linha em providers) ao final da janela analisada? */
  has_provider: boolean;
  /** Existe pelo menos 1 service publicado? */
  has_service: boolean;
  /** Provider.onboarding_completed = true? */
  onboarding_completed: boolean;
  /** Service possui categoria? */
  service_has_category?: boolean;
  /** Existe draft (bet_drafts/onboarding_v2_drafts)? */
  has_draft?: boolean;
  /** Draft tem envelope válido (versão+checksum ok)? */
  draft_envelope_valid?: boolean;
}

export interface ForensicFinding {
  kind: ForensicFindingKind;
  severity: 'low' | 'medium' | 'high' | 'critical';
  phase?: string | null;
  evidence: string[];
  detected_at: string;
  reason: string;
}

export type ForensicFindingKind =
  | 'phantom_success'
  | 'silent_failure'
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
  | 'incomplete_transaction'
  | 'broken_chain'
  | 'state_fragmentation';

export interface TimelineEntry {
  type: ForensicEventType;
  event: string;
  phase?: string | null;
  at: string;
  /** ms desde o primeiro evento da timeline. */
  relative_ms: number;
  state_before?: string | null;
  state_after?: string | null;
  integrity_flags: string[];
  truth_flags: string[];
  divergence_flags: string[];
  retry_flags: string[];
  recovery_flags: string[];
}

export interface RealityGraphNode {
  id: string;
  kind:
    | 'phase'
    | 'persist'
    | 'recovery'
    | 'validation'
    | 'navigation'
    | 'refresh'
    | 'submit'
    | 'abandon'
    | 'toast'
    | 'db_confirm';
  label: string;
  occurrences: number;
}

export interface RealityGraphEdge {
  from: string;
  to: string;
  kind: 'causality' | 'temporal' | 'retry' | 'recovery' | 'divergence' | 'contradiction';
  weight: number;
}

export interface RealityGraph {
  nodes: RealityGraphNode[];
  edges: RealityGraphEdge[];
}

export interface JourneyReconstruction {
  session_id: string | null;
  user_id: string | null;
  events: ForensicEvent[];
  timeline: TimelineEntry[];
  phase_visits: Record<string, number>;
  total_refreshes: number;
  total_recoveries: number;
  total_retries: number;
  reached_completion_ui: boolean;
  reached_celebration: boolean;
  abandoned: boolean;
}

export interface OperationalScores {
  operational_truth_score: number;
  persistence_integrity_score: number;
  recovery_integrity_score: number;
  flow_trust_score: number;
  session_integrity_score: number;
}

export interface RealityReport {
  journey: JourneyReconstruction;
  graph: RealityGraph;
  findings: ForensicFinding[];
  scores: OperationalScores;
}

// ============================================================================
// SAFE EVENT NORMALIZATION
// ============================================================================

const PII_KEY_PATTERN = /(email|whats|phone|cpf|cnpj|tax_id|address|name|password|token|cep|street|complement|raw_input|payload|text|value)/i;

/** Sanitiza meta removendo chaves suspeitas de PII / raw input. */
export function sanitizeMeta(meta: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!meta || typeof meta !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (PII_KEY_PATTERN.test(k)) continue;
    const t = typeof v;
    if (t === 'number' || t === 'boolean') {
      out[k] = v;
    } else if (t === 'string') {
      const s = v as string;
      // Aceita apenas strings curtas e sem padrão de email/telefone
      if (s.length <= 64 && !/[@]|\d{10,}/.test(s)) out[k] = s;
    }
  }
  return out;
}

function classifyEvent(e: string): ForensicEventType {
  const x = (e || '').toLowerCase();
  if (x.includes('phase_enter')) return 'phase_enter';
  if (x.includes('phase_exit')) return 'phase_exit';
  if (x === 'next' || x.endsWith('_next')) return 'next';
  if (x === 'back' || x.endsWith('_back')) return 'back';
  if (x === 'skip' || x.endsWith('_skip')) return 'skip';
  if (x.includes('submit')) return 'submit';
  if (x.includes('persist_ok') || x.includes('persist_success')) return 'persist_ok';
  if (x.includes('persist_failed') || x.includes('persist_error')) return 'persist_failed';
  if (x.includes('autosave_remote_ok') || x.includes('autosave_ok')) return 'autosave_ok';
  if (x.includes('autosave_failed')) return 'autosave_failed';
  if (x.includes('recovery_corrupted')) return 'recovery_corrupted';
  if (x.includes('recovery_discarded')) return 'recovery_discarded';
  if (x.includes('recovery_')) return 'recovery_used';
  if (x.includes('validation_failed')) return 'validation_failed';
  if (x.includes('refresh') || x.includes('reload')) return 'refresh';
  if (x.includes('abandonment')) return 'abandonment_suspected';
  if (x.includes('toast_success') || x === 'toast_ok') return 'toast_success';
  if (x.includes('toast_error')) return 'toast_error';
  if (x === 'completion' || x.includes('complete')) return 'completion';
  if (x.includes('celebration')) return 'celebration';
  if (x.includes('navigation') || x.includes('redirect') || x.includes('nav_')) return 'navigation';
  if (x.includes('concurrent_tab')) return 'concurrent_tab_detected';
  return 'unknown';
}

// ============================================================================
// JOURNEY RECONSTRUCTION
// ============================================================================

export function reconstructUserJourney(events: readonly ForensicEvent[]): JourneyReconstruction {
  const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const phase_visits: Record<string, number> = {};
  let total_refreshes = 0;
  let total_recoveries = 0;
  let total_retries = 0;
  let reached_completion_ui = false;
  let reached_celebration = false;
  let abandoned = false;

  for (const ev of sorted) {
    const t = classifyEvent(ev.event);
    if (ev.phase) phase_visits[ev.phase] = (phase_visits[ev.phase] || 0) + 1;
    if (t === 'refresh') total_refreshes++;
    if (t === 'recovery_used' || t === 'recovery_corrupted' || t === 'recovery_discarded') total_recoveries++;
    if (t === 'submit' || t === 'next') total_retries++;
    if (t === 'completion') reached_completion_ui = true;
    if (t === 'celebration') reached_celebration = true;
    if (t === 'abandonment_suspected') abandoned = true;
  }

  return {
    session_id: sorted[0]?.session_id ?? null,
    user_id: sorted[0]?.user_id ?? null,
    events: sorted,
    timeline: buildOperationalTimeline(sorted),
    phase_visits,
    total_refreshes,
    total_recoveries,
    total_retries,
    reached_completion_ui,
    reached_celebration,
    abandoned,
  };
}

export function buildOperationalTimeline(events: readonly ForensicEvent[]): TimelineEntry[] {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const base = new Date(sorted[0].created_at).getTime();
  let lastPhase: string | null = null;

  return sorted.map((ev) => {
    const type = classifyEvent(ev.event);
    const at = ev.created_at;
    const relative_ms = Math.max(0, new Date(at).getTime() - base);
    const integrity_flags: string[] = [];
    const truth_flags: string[] = [];
    const divergence_flags: string[] = [];
    const retry_flags: string[] = [];
    const recovery_flags: string[] = [];

    if (type === 'persist_failed') integrity_flags.push('persist_failed');
    if (type === 'autosave_failed') integrity_flags.push('autosave_failed');
    if (type === 'recovery_corrupted') recovery_flags.push('corrupted');
    if (type === 'recovery_discarded') recovery_flags.push('discarded');
    if (type === 'recovery_used') recovery_flags.push('used');
    if (type === 'refresh') retry_flags.push('refresh');
    if (type === 'submit') retry_flags.push('submit');
    if (type === 'toast_success') truth_flags.push('toast_success');
    if (type === 'completion') truth_flags.push('ui_completion');
    if (lastPhase && ev.phase && lastPhase === ev.phase && (type === 'next' || type === 'back')) {
      divergence_flags.push('phase_stuck');
    }

    const state_before = lastPhase;
    const state_after = ev.phase ?? lastPhase;
    lastPhase = state_after;

    return {
      type,
      event: ev.event,
      phase: ev.phase ?? null,
      at,
      relative_ms,
      state_before,
      state_after,
      integrity_flags,
      truth_flags,
      divergence_flags,
      retry_flags,
      recovery_flags,
    };
  });
}

// ============================================================================
// DETECTORS
// ============================================================================

function ev(at: string, kind: ForensicFindingKind, reason: string, severity: ForensicFinding['severity'], phase?: string | null, evidence: string[] = []): ForensicFinding {
  return { kind, severity, reason, phase: phase ?? null, evidence, detected_at: at };
}

export function detectPhantomSuccess(journey: JourneyReconstruction, backend: BackendTruth | null): ForensicFinding[] {
  if (!backend) return [];
  const out: ForensicFinding[] = [];
  if ((journey.reached_celebration || journey.reached_completion_ui) && !backend.has_provider) {
    out.push(ev(journey.events.at(-1)?.created_at ?? new Date().toISOString(),
      'phantom_success', 'UI alcançou celebration/completion mas provider não existe no backend.', 'critical', null, ['ui_completion', 'backend.has_provider=false']));
  }
  if ((journey.reached_celebration || journey.reached_completion_ui) && backend.has_provider && !backend.has_service) {
    out.push(ev(journey.events.at(-1)?.created_at ?? new Date().toISOString(),
      'phantom_success', 'UI concluiu mas nenhum service foi persistido.', 'high', null, ['ui_completion', 'backend.has_service=false']));
  }
  return out;
}

export function detectSilentFailures(journey: JourneyReconstruction, backend: BackendTruth | null): ForensicFinding[] {
  const out: ForensicFinding[] = [];
  const persistFailed = journey.events.filter((e) => classifyEvent(e.event) === 'persist_failed').length;
  const toastSuccess = journey.events.filter((e) => classifyEvent(e.event) === 'toast_success').length;
  if (toastSuccess > 0 && persistFailed > 0) {
    out.push(ev(journey.events.at(-1)?.created_at ?? new Date().toISOString(),
      'silent_failure', `Toast de sucesso (${toastSuccess}) coexistiu com persist_failed (${persistFailed}).`,
      'high', null, [`toast_success=${toastSuccess}`, `persist_failed=${persistFailed}`]));
  }
  if (backend && toastSuccess > 0 && !backend.has_provider && journey.reached_completion_ui) {
    out.push(ev(journey.events.at(-1)?.created_at ?? new Date().toISOString(),
      'silent_failure', 'Toast de sucesso anunciado, sem provider persistido.',
      'critical', null, ['toast_success>0', 'backend.has_provider=false']));
  }
  return out;
}

export function detectPartialPersistence(backend: BackendTruth | null): ForensicFinding[] {
  if (!backend) return [];
  const out: ForensicFinding[] = [];
  if (backend.has_provider && !backend.has_service) {
    out.push(ev(new Date().toISOString(),
      'partial_persistence', 'Provider existe mas nenhum service foi criado.', 'high', null, ['provider=true', 'service=false']));
  }
  if (backend.has_service && backend.service_has_category === false) {
    out.push(ev(new Date().toISOString(),
      'partial_persistence', 'Service existe sem categoria associada.', 'medium', null, ['service=true', 'category=false']));
  }
  if (backend.onboarding_completed && !backend.has_service) {
    out.push(ev(new Date().toISOString(),
      'impossible_state', 'onboarding_completed=true sem service real.', 'critical', null, ['completed=true', 'service=false']));
  }
  return out;
}

export function detectZombieDraft(journey: JourneyReconstruction, backend: BackendTruth | null): ForensicFinding[] {
  if (!backend) return [];
  const out: ForensicFinding[] = [];
  const recoveryUsed = journey.events.filter((e) => classifyEvent(e.event) === 'recovery_used').length;
  if (recoveryUsed > 0 && backend.draft_envelope_valid === false) {
    out.push(ev(journey.events.at(-1)?.created_at ?? new Date().toISOString(),
      'zombie_draft', 'Recovery utilizado com envelope inválido (versão/checksum).', 'high', null, [`recovery_used=${recoveryUsed}`, 'envelope_valid=false']));
  }
  if (backend.has_draft && !backend.has_service && journey.reached_celebration) {
    out.push(ev(journey.events.at(-1)?.created_at ?? new Date().toISOString(),
      'zombie_draft', 'Draft persistido mas nenhum service foi criado após celebration.', 'medium', null, ['draft=true', 'service=false']));
  }
  return out;
}

export function detectHiddenLoops(journey: JourneyReconstruction): ForensicFinding[] {
  const out: ForensicFinding[] = [];
  const seq = journey.events.map((e) => e.phase ?? '_').filter((p) => p !== '_');
  if (seq.length < 4) return out;
  let alternations = 0;
  for (let i = 2; i < seq.length; i++) {
    if (seq[i] === seq[i - 2] && seq[i] !== seq[i - 1]) alternations++;
  }
  if (alternations >= 3) {
    out.push(ev(journey.events.at(-1)?.created_at ?? new Date().toISOString(),
      'hidden_loop', `Alternância A↔B detectada ${alternations}x entre fases.`, 'medium', null, [`alternations=${alternations}`]));
  }
  for (const [phase, visits] of Object.entries(journey.phase_visits)) {
    if (visits >= 5) {
      out.push(ev(journey.events.at(-1)?.created_at ?? new Date().toISOString(),
        'hidden_loop', `Fase ${phase} visitada ${visits} vezes.`, 'high', phase, [`visits=${visits}`]));
    }
  }
  return out;
}

export function detectRetryStorm(journey: JourneyReconstruction, windowMs = 30_000, minRetries = 5): ForensicFinding[] {
  const out: ForensicFinding[] = [];
  const submits = journey.events
    .filter((e) => ['submit', 'persist_ok', 'persist_failed', 'recovery_used'].includes(classifyEvent(e.event)))
    .map((e) => new Date(e.created_at).getTime())
    .sort((a, b) => a - b);
  for (let i = 0; i + minRetries - 1 < submits.length; i++) {
    if (submits[i + minRetries - 1] - submits[i] <= windowMs) {
      out.push(ev(new Date(submits[i + minRetries - 1]).toISOString(),
        'retry_storm', `${minRetries} retries em ≤${windowMs}ms.`, 'high', null, [`retries=${minRetries}`, `window_ms=${windowMs}`]));
      break;
    }
  }
  return out;
}

export function detectDeadNavigation(journey: JourneyReconstruction): ForensicFinding[] {
  const out: ForensicFinding[] = [];
  let stuckPhase: string | null = null;
  let stuckCount = 0;
  for (const t of journey.timeline) {
    if ((t.type === 'next' || t.type === 'back') && t.state_before && t.state_before === t.state_after) {
      if (stuckPhase === t.state_before) stuckCount++;
      else { stuckPhase = t.state_before; stuckCount = 1; }
      if (stuckCount >= 3) {
        out.push(ev(t.at, 'dead_navigation', `${stuckCount} cliques sem avanço na fase ${stuckPhase}.`, 'medium', stuckPhase, [`stuck=${stuckCount}`]));
        return out;
      }
    } else {
      stuckPhase = null;
      stuckCount = 0;
    }
  }
  return out;
}

export function detectToastVsRealityMismatch(journey: JourneyReconstruction, backend: BackendTruth | null): ForensicFinding[] {
  const out: ForensicFinding[] = [];
  const toastSuccess = journey.events.filter((e) => classifyEvent(e.event) === 'toast_success').length;
  if (!toastSuccess || !backend) return out;
  if (!backend.has_provider && !backend.has_draft) {
    out.push(ev(journey.events.at(-1)?.created_at ?? new Date().toISOString(),
      'toast_vs_reality', 'Toast(s) de sucesso sem qualquer evidência operacional (sem provider e sem draft).',
      'high', null, [`toast_success=${toastSuccess}`]));
  }
  return out;
}

export function detectUiVsBackendDivergence(journey: JourneyReconstruction, backend: BackendTruth | null): ForensicFinding[] {
  if (!backend) return [];
  const out: ForensicFinding[] = [];
  if (journey.reached_completion_ui && !backend.onboarding_completed) {
    out.push(ev(journey.events.at(-1)?.created_at ?? new Date().toISOString(),
      'ui_vs_backend_divergence', 'UI mostrou completion mas onboarding_completed=false no backend.',
      'high', null, ['ui_completion', 'backend.completed=false']));
  }
  if (!journey.reached_completion_ui && backend.onboarding_completed && backend.has_service) {
    out.push(ev(journey.events.at(-1)?.created_at ?? new Date().toISOString(),
      'ui_vs_backend_divergence', 'Backend concluído mas UI nunca emitiu completion na sessão.',
      'low', null, ['ui_completion=false', 'backend.completed=true']));
  }
  return out;
}

export function detectImpossibleStates(journey: JourneyReconstruction, backend: BackendTruth | null): ForensicFinding[] {
  const out: ForensicFinding[] = [];
  if (journey.reached_celebration && journey.total_retries === 0) {
    out.push(ev(journey.events.at(-1)?.created_at ?? new Date().toISOString(),
      'impossible_state', 'Celebration alcançada sem nenhum submit/next prévio.', 'medium', null, []));
  }
  if (backend && backend.onboarding_completed && !backend.has_provider) {
    out.push(ev(new Date().toISOString(),
      'impossible_state', 'onboarding_completed=true sem provider.', 'critical', null, []));
  }
  return out;
}

export function detectSessionFragmentation(events: readonly ForensicEvent[]): ForensicFinding[] {
  const sessions = new Set<string>();
  const devices = new Set<string>();
  for (const e of events) {
    if (e.session_id) sessions.add(e.session_id);
    if (e.device_id) devices.add(e.device_id);
  }
  const out: ForensicFinding[] = [];
  if (sessions.size >= 3 || devices.size >= 2) {
    out.push(ev(events.at(-1)?.created_at ?? new Date().toISOString(),
      'session_fragmentation', `Fragmentação detectada: ${sessions.size} sessões, ${devices.size} devices.`,
      sessions.size >= 5 || devices.size >= 3 ? 'high' : 'medium',
      null, [`sessions=${sessions.size}`, `devices=${devices.size}`]));
  }
  return out;
}

export function detectRecoveryIntegrityFailure(journey: JourneyReconstruction): ForensicFinding[] {
  const out: ForensicFinding[] = [];
  const corrupted = journey.events.filter((e) => classifyEvent(e.event) === 'recovery_corrupted').length;
  const used = journey.events.filter((e) => classifyEvent(e.event) === 'recovery_used').length;
  if (corrupted > 0) {
    out.push(ev(journey.events.at(-1)?.created_at ?? new Date().toISOString(),
      'recovery_integrity_failure', `${corrupted} eventos recovery_corrupted.`, 'high', null, [`corrupted=${corrupted}`]));
  }
  if (used > 0 && journey.total_recoveries > used * 3) {
    out.push(ev(journey.events.at(-1)?.created_at ?? new Date().toISOString(),
      'recovery_integrity_failure', 'Razão de recoveries descartados >> aplicados.', 'medium', null, []));
  }
  return out;
}

export function detectIncompleteTransactions(journey: JourneyReconstruction): ForensicFinding[] {
  const out: ForensicFinding[] = [];
  const types = journey.events.map((e) => classifyEvent(e.event));
  for (let i = 0; i < types.length; i++) {
    if (types[i] === 'submit') {
      const after = types.slice(i + 1, i + 6);
      if (!after.some((t) => t === 'persist_ok' || t === 'persist_failed' || t === 'completion')) {
        out.push(ev(journey.events[i].created_at,
          'incomplete_transaction', 'Submit sem confirmação posterior (persist_ok/persist_failed/completion).',
          'medium', journey.events[i].phase ?? null, [`event=${journey.events[i].event}`]));
        break;
      }
    }
  }
  return out;
}

export function detectStateFragmentation(journey: JourneyReconstruction): ForensicFinding[] {
  const out: ForensicFinding[] = [];
  const phases = Object.keys(journey.phase_visits);
  if (phases.length >= 6 && journey.total_refreshes >= 2) {
    out.push(ev(journey.events.at(-1)?.created_at ?? new Date().toISOString(),
      'state_fragmentation', `Estado fragmentado: ${phases.length} fases visitadas com ${journey.total_refreshes} refreshes.`,
      'low', null, [`phases=${phases.length}`, `refreshes=${journey.total_refreshes}`]));
  }
  return out;
}

export function detectPersistIntegrityFailure(journey: JourneyReconstruction): ForensicFinding[] {
  const out: ForensicFinding[] = [];
  const failed = journey.events.filter((e) => classifyEvent(e.event) === 'persist_failed').length;
  const ok = journey.events.filter((e) => classifyEvent(e.event) === 'persist_ok').length;
  if (failed > 0 && ok === 0) {
    out.push(ev(journey.events.at(-1)?.created_at ?? new Date().toISOString(),
      'broken_chain', `${failed} persist_failed sem nenhum persist_ok subsequente.`, 'high', null, [`persist_failed=${failed}`]));
  }
  return out;
}

// ============================================================================
// AGGREGATE FINDINGS
// ============================================================================

export function generateForensicFindings(
  events: readonly ForensicEvent[],
  backend: BackendTruth | null,
): { journey: JourneyReconstruction; findings: ForensicFinding[] } {
  const journey = reconstructUserJourney(events);
  const findings: ForensicFinding[] = [
    ...detectPhantomSuccess(journey, backend),
    ...detectSilentFailures(journey, backend),
    ...detectPartialPersistence(backend),
    ...detectZombieDraft(journey, backend),
    ...detectHiddenLoops(journey),
    ...detectRetryStorm(journey),
    ...detectDeadNavigation(journey),
    ...detectToastVsRealityMismatch(journey, backend),
    ...detectUiVsBackendDivergence(journey, backend),
    ...detectImpossibleStates(journey, backend),
    ...detectSessionFragmentation(events),
    ...detectRecoveryIntegrityFailure(journey),
    ...detectIncompleteTransactions(journey),
    ...detectStateFragmentation(journey),
    ...detectPersistIntegrityFailure(journey),
  ];
  return { journey, findings };
}

// ============================================================================
// SCORES
// ============================================================================

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

const SEVERITY_WEIGHT: Record<ForensicFinding['severity'], number> = {
  low: 4,
  medium: 10,
  high: 20,
  critical: 35,
};

export function computeOperationalTruthScore(findings: readonly ForensicFinding[]): number {
  const critical = ['phantom_success', 'silent_failure', 'toast_vs_reality', 'ui_vs_backend_divergence', 'impossible_state'];
  const penalty = findings
    .filter((f) => critical.includes(f.kind))
    .reduce((acc, f) => acc + SEVERITY_WEIGHT[f.severity], 0);
  return clamp(100 - penalty);
}

export function computePersistenceIntegrity(journey: JourneyReconstruction, backend: BackendTruth | null, findings: readonly ForensicFinding[]): number {
  let score = 100;
  for (const f of findings) {
    if (['partial_persistence', 'broken_chain', 'incomplete_transaction', 'impossible_state'].includes(f.kind)) {
      score -= SEVERITY_WEIGHT[f.severity];
    }
  }
  const failed = journey.events.filter((e) => classifyEvent(e.event) === 'persist_failed').length;
  score -= Math.min(30, failed * 5);
  if (backend && journey.reached_completion_ui && !backend.has_provider) score -= 30;
  return clamp(score);
}

export function computeRecoveryIntegrity(journey: JourneyReconstruction, findings: readonly ForensicFinding[]): number {
  let score = 100;
  for (const f of findings) {
    if (['recovery_integrity_failure', 'zombie_draft'].includes(f.kind)) {
      score -= SEVERITY_WEIGHT[f.severity];
    }
  }
  const corrupted = journey.events.filter((e) => classifyEvent(e.event) === 'recovery_corrupted').length;
  score -= corrupted * 10;
  return clamp(score);
}

export function computeFlowTrust(journey: JourneyReconstruction, findings: readonly ForensicFinding[]): number {
  let score = 100;
  for (const f of findings) {
    if (['hidden_loop', 'dead_navigation', 'retry_storm', 'state_fragmentation'].includes(f.kind)) {
      score -= SEVERITY_WEIGHT[f.severity];
    }
  }
  score -= Math.min(20, journey.total_refreshes * 4);
  return clamp(score);
}

export function computeSessionIntegrity(events: readonly ForensicEvent[], findings: readonly ForensicFinding[]): number {
  let score = 100;
  for (const f of findings) {
    if (f.kind === 'session_fragmentation') score -= SEVERITY_WEIGHT[f.severity];
  }
  const sessions = new Set(events.map((e) => e.session_id).filter(Boolean)).size;
  if (sessions >= 3) score -= (sessions - 2) * 10;
  return clamp(score);
}

export function computeJourneyIntegrity(report: Omit<RealityReport, 'scores'>): OperationalScores {
  const ots = computeOperationalTruthScore(report.findings);
  const pi = computePersistenceIntegrity(report.journey, null, report.findings);
  const ri = computeRecoveryIntegrity(report.journey, report.findings);
  const ft = computeFlowTrust(report.journey, report.findings);
  const si = computeSessionIntegrity(report.journey.events, report.findings);
  return {
    operational_truth_score: ots,
    persistence_integrity_score: pi,
    recovery_integrity_score: ri,
    flow_trust_score: ft,
    session_integrity_score: si,
  };
}

// ============================================================================
// REALITY GRAPH
// ============================================================================

export function buildRealityGraph(journey: JourneyReconstruction): RealityGraph {
  const nodes = new Map<string, RealityGraphNode>();
  const edges = new Map<string, RealityGraphEdge>();

  function nodeKind(type: ForensicEventType): RealityGraphNode['kind'] {
    if (type === 'persist_ok' || type === 'persist_failed' || type === 'autosave_ok' || type === 'autosave_failed') return 'persist';
    if (type === 'recovery_used' || type === 'recovery_corrupted' || type === 'recovery_discarded') return 'recovery';
    if (type === 'validation_failed') return 'validation';
    if (type === 'navigation' || type === 'next' || type === 'back' || type === 'skip') return 'navigation';
    if (type === 'refresh') return 'refresh';
    if (type === 'submit') return 'submit';
    if (type === 'abandonment_suspected') return 'abandon';
    if (type === 'toast_success' || type === 'toast_error') return 'toast';
    if (type === 'completion' || type === 'celebration') return 'db_confirm';
    return 'phase';
  }

  function upsertNode(id: string, kind: RealityGraphNode['kind'], label: string) {
    const ex = nodes.get(id);
    if (ex) ex.occurrences++;
    else nodes.set(id, { id, kind, label, occurrences: 1 });
  }

  function upsertEdge(from: string, to: string, kind: RealityGraphEdge['kind']) {
    const key = `${from}->${to}::${kind}`;
    const ex = edges.get(key);
    if (ex) ex.weight++;
    else edges.set(key, { from, to, kind, weight: 1 });
  }

  let prevId: string | null = null;
  for (const t of journey.timeline) {
    const id = `${nodeKind(t.type)}:${t.phase ?? '_'}:${t.type}`;
    upsertNode(id, nodeKind(t.type), `${t.type}${t.phase ? ` @ ${t.phase}` : ''}`);
    if (prevId) {
      const edgeKind: RealityGraphEdge['kind'] =
        t.divergence_flags.length ? 'divergence' :
        t.retry_flags.length ? 'retry' :
        t.recovery_flags.length ? 'recovery' :
        'temporal';
      upsertEdge(prevId, id, edgeKind);
    }
    prevId = id;
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

// ============================================================================
// CROSS-LAYER CORRELATION
// ============================================================================

export interface CrossLayerSignals {
  release_app_version?: string | null;
  active_experiments?: readonly string[];
  open_incidents?: readonly string[];
  regression_metrics?: readonly string[];
  runtime_drift_items?: readonly string[];
}

export interface CorrelatedReality {
  causal_release: string | null;
  suspect_experiments: string[];
  related_incidents: string[];
  drift_intersections: string[];
}

export function correlateRealitySignals(
  journey: JourneyReconstruction,
  findings: readonly ForensicFinding[],
  signals: CrossLayerSignals,
): CorrelatedReality {
  const versions = new Set<string>();
  for (const e of journey.events) if (e.app_version) versions.add(e.app_version);
  const causal_release =
    findings.some((f) => f.severity === 'critical' || f.severity === 'high') && versions.size === 1
      ? [...versions][0]
      : signals.release_app_version ?? null;

  return {
    causal_release,
    suspect_experiments: [...(signals.active_experiments ?? [])].slice(0, 10),
    related_incidents: [...(signals.open_incidents ?? [])].slice(0, 10),
    drift_intersections: [...(signals.runtime_drift_items ?? [])].slice(0, 10),
  };
}

// ============================================================================
// REPORT
// ============================================================================

export function buildRealityReport(
  events: readonly ForensicEvent[],
  backend: BackendTruth | null,
): RealityReport {
  const { journey, findings } = generateForensicFindings(events, backend);
  const graph = buildRealityGraph(journey);
  const scores = computeJourneyIntegrity({ journey, graph, findings });
  return { journey, graph, findings, scores };
}

/**
 * celebrate.ts — Unified achievement feedback (confetti + sound).
 *
 * Centraliza o "Ebá!" da plataforma para garantir consistência sensorial
 * em todas as conquistas (signup, novo serviço, novo álbum, level up, etc.).
 *
 * - Confete: dynamic-import de canvas-confetti (já é dependência do projeto).
 * - Som: Web Audio API (sem assets externos), funciona em mobile e desktop.
 *   Usa um arpejo curto (Mi → Sol# → Si → Mi8va) que soa como "pling/ebá".
 *
 * Os disparos são best-effort: qualquer falha (ex: contexto suspenso por
 * autoplay policy) é silenciosamente ignorada, sem quebrar o fluxo da UI.
 *
 * Preferência de áudio: sincronizada com o perfil do usuário via Dashboard.
 * O confete continua disparando mesmo quando o som está silenciado.
 */

const CELEBRATION_SESSION_PREFIX = 'pdu_celebrate_once:';
const CELEBRATION_COOLDOWN_MS = 60_000;
const TELEMETRY_ACTION_TRIGGERED = 'celebration.triggered';
const TELEMETRY_ACTION_BLOCKED = 'celebration.blocked_cooldown';
export const DEFAULT_CELEBRATION_MUTED = false;
let sessionKeysCleaned = false;
let celebrationMuted = DEFAULT_CELEBRATION_MUTED;

export const CELEBRATION_IDS = {
  welcomeOnboarding: (userId?: string | null) => `welcome-onboarding:${userId || 'anonymous'}`,
  onboardingComplete: (userId: string) => `onboarding-complete:${userId}`,
  levelUp: (level: string, userId: string) => `level-up:${level}:${userId}`,
  serviceSlot: (serviceId: string) => `portfolio-service:${serviceId}`,
  portfolioAlbum: (albumId: string) => `portfolio-album:${albumId}`,
  portfolioPhoto: (albumId: string, photoTotal: number) => `portfolio-photo:${albumId}:${photoTotal}`,
} as const;

export function isCelebrationMuted(): boolean {
  return celebrationMuted;
}

export function setCelebrationMuted(muted: boolean) {
  celebrationMuted = muted ?? DEFAULT_CELEBRATION_MUTED;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('pdu:celebrate-muted-change', { detail: { muted } }));
}

export function resolveCelebrationMutedPreference(value: unknown): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_CELEBRATION_MUTED;
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** Plays a short happy "pling/ebá" arpeggio. Safe to call repeatedly. */
export function playAchievementSound(volume = 0.18) {
  if (isCelebrationMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  // Mi5, Sol#5, Si5, Mi6 — arpeggio maior alegre
  const notes = [659.25, 830.61, 987.77, 1318.51];
  const now = ctx.currentTime;
  const noteDur = 0.12;

  notes.forEach((freq, i) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = now + i * 0.07;
      const end = start + noteDur;
      // Envelope ADSR rápido para evitar "click"
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, end);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    } catch {
      /* noop */
    }
  });
}

interface ConfettiOptions {
  /** "big" = boas-vindas / level up. "mini" = item desbloqueado. */
  intensity?: 'big' | 'mini';
  /** Optional idempotency key. Same id is ignored for 60s in the current tab session. */
  id?: string;
}

function shouldRunCelebration(id?: string): { allowed: boolean; cooldownRemainingMs?: number } {
  if (!id || typeof window === 'undefined') return { allowed: true };
  try {
    cleanupExpiredSessionKeys();
    const key = `${CELEBRATION_SESSION_PREFIX}${id}`;
    const lastRun = Number(sessionStorage.getItem(key) || '0');
    const now = Date.now();
    if (lastRun && now - lastRun < CELEBRATION_COOLDOWN_MS) {
      return { allowed: false, cooldownRemainingMs: CELEBRATION_COOLDOWN_MS - (now - lastRun) };
    }
    sessionStorage.setItem(key, String(now));
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

async function logCelebrationTelemetry(
  action: typeof TELEMETRY_ACTION_TRIGGERED | typeof TELEMETRY_ACTION_BLOCKED,
  opts: ConfettiOptions,
  cooldownRemainingMs?: number,
) {
  if (!opts.id || typeof window === 'undefined') return;
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action,
      resource_type: 'celebration',
      resource_id: opts.id,
      details: {
        celebration_id: opts.id,
        intensity: opts.intensity ?? 'big',
        cooldown_ms: CELEBRATION_COOLDOWN_MS,
        cooldown_remaining_ms: cooldownRemainingMs ?? null,
        page_path: window.location.pathname,
      },
    } as any);
  } catch {
    /* telemetry is best-effort */
  }
}

function cleanupExpiredSessionKeys() {
  if (sessionKeysCleaned || typeof window === 'undefined') return;
  sessionKeysCleaned = true;
  try {
    const now = Date.now();
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith(CELEBRATION_SESSION_PREFIX)) continue;
      const ts = Number(sessionStorage.getItem(key) || '0');
      if (!ts || now - ts >= CELEBRATION_COOLDOWN_MS) sessionStorage.removeItem(key);
    }
  } catch {
    /* noop */
  }
}

/** Fires confetti. Falls back to noop if dependency unavailable. */
export async function fireConfetti(opts: ConfettiOptions = {}) {
  if (typeof window === 'undefined') return;
  try {
    const confetti = (await import('canvas-confetti')).default;
    if (opts.intensity === 'mini') {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
      return;
    }
    // Big celebration: two bursts
    confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    setTimeout(() => {
      confetti({ particleCount: 80, spread: 120, origin: { y: 0.5 } });
    }, 220);
  } catch {
    /* noop */
  }
}

/** Combined helper: confetti + sound. Use for any "win" moment. */
export function celebrate(opts: ConfettiOptions = {}) {
  if (typeof window === 'undefined') return;
  const decision = shouldRunCelebration(opts.id);
  if (!decision.allowed) {
    void logCelebrationTelemetry(TELEMETRY_ACTION_BLOCKED, opts, decision.cooldownRemainingMs);
    return;
  }
  void logCelebrationTelemetry(TELEMETRY_ACTION_TRIGGERED, opts);
  void fireConfetti(opts);
  playAchievementSound(opts.intensity === 'mini' ? 0.14 : 0.2);
}

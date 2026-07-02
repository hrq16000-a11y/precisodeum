/**
 * betDopamine.ts — Feedback "Bet Mode" para o cadastro V3.
 *
 * Camada acima de celebrate.ts focada em sensação de ganho imediato:
 *   - rajadas de confete (não apenas um disparo)
 *   - som "caixa registradora / moedas caindo" via WebAudio
 *   - hook utilitário para selo "piscar antes de fixar"
 *
 * Sem dependências novas. Tudo é dynamic-import / WebAudio nativo.
 * Respeita isCelebrationMuted() do celebrate.ts.
 */
import { isCelebrationMuted } from '@/lib/celebrate';

let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!Ctor) return null;
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch { return null; }
}

/** Som de "moedas caindo / caixa registradora" — vários blips rápidos descendentes + ding final. */
export function playCoinsSound(volume = 0.18) {
  if (isCelebrationMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  // Cascata de moedas (frequências altas, decaimento rápido)
  const coins = [1760, 1568, 1396.91, 1244.51, 1108.73, 987.77, 1318.51];
  coins.forEach((freq, i) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = now + i * 0.045;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.14);
    } catch { /* noop */ }
  });
  // Ding final (caixa registradora)
  try {
    const ding = ctx.createOscillator();
    const dg = ctx.createGain();
    ding.type = 'sine';
    ding.frequency.value = 2093; // C7
    const t = now + coins.length * 0.045 + 0.05;
    dg.gain.setValueAtTime(0.0001, t);
    dg.gain.exponentialRampToValueAtTime(volume * 0.9, t + 0.01);
    dg.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    ding.connect(dg).connect(ctx.destination);
    ding.start(t);
    ding.stop(t + 0.65);
  } catch { /* noop */ }
}

/** "Cha-ching!" curto para micro-conquistas (campo preenchido). */
export function playChaChingSound(volume = 0.14) {
  if (isCelebrationMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  [880, 1318.51].forEach((freq, i) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const t = now + i * 0.07;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    } catch { /* noop */ }
  });
}

/** Som grave de "selo carimbado". */
export function playStampSound(volume = 0.22) {
  if (isCelebrationMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* noop */ }
}

/** Rajadas de confete (3 ondas), best-effort. */
export async function burstConfetti(intensity: 'normal' | 'mega' = 'normal') {
  if (isCelebrationMuted()) {/* confete pode rodar mesmo mudo, mantemos */ }
  try {
    const mod = await import('canvas-confetti');
    const confetti = (mod as any).default ?? (mod as any);
    const waves = intensity === 'mega' ? 4 : 3;
    const colors = ['#FFD700', '#FF6A00', '#34D399', '#60A5FA', '#F472B6'];
    for (let w = 0; w < waves; w++) {
      window.setTimeout(() => {
        confetti({
          particleCount: intensity === 'mega' ? 110 : 70,
          spread: 75,
          startVelocity: 45,
          origin: { y: 0.6, x: 0.5 + (w % 2 === 0 ? -0.15 : 0.15) },
          colors,
          scalar: 1.05,
        });
      }, w * 220);
    }
  } catch { /* noop */ }
}

/** Combo padrão "campo concluído com sucesso". */
export function fieldWin() {
  playChaChingSound();
}

/** Combo padrão "etapa concluída" — confete + moedas. */
export async function stageWin(intensity: 'normal' | 'mega' = 'normal') {
  playCoinsSound(intensity === 'mega' ? 0.22 : 0.18);
  await burstConfetti(intensity);
}

/** Combo "selo conquistado" — som grave + confete dourado focado. */
export async function badgeWin() {
  playStampSound();
  try {
    const mod = await import('canvas-confetti');
    const confetti = (mod as any).default ?? (mod as any);
    confetti({
      particleCount: 140,
      spread: 100,
      startVelocity: 55,
      origin: { y: 0.5 },
      colors: ['#FFD700', '#FFB800', '#F59E0B', '#FDE047'],
      scalar: 1.2,
      ticks: 220,
    });
  } catch { /* noop */ }
}

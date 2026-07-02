/**
 * Efeitos sonoros leves via WebAudio — sem assets externos.
 * Usados para reforçar eventos de performance (Ping de Sucesso, etc).
 */

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    if (!_ctx) _ctx = new Ctor();
    if (_ctx.state === 'suspended') void _ctx.resume();
    return _ctx;
  } catch {
    return null;
  }
}

/**
 * "Buzina" curta de 2 toques. Volume baixo (0.18) para não assustar.
 * Tolerante a falhas — se o navegador bloquear áudio sem interação, apenas retorna.
 */
export function playHornBeep(): void {
  const ctx = getCtx();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);

    const blast = (start: number, durationMs: number, baseFreq: number) => {
      const dur = durationMs / 1000;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      const gain = ctx.createGain();

      // Envelope: ataque rápido, sustain curto, release suave
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(1, start + 0.015);
      gain.gain.setValueAtTime(1, start + dur * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      // Pitch bend pequeno tipo buzina
      osc.frequency.setValueAtTime(baseFreq, start);
      osc.frequency.linearRampToValueAtTime(baseFreq * 0.92, start + dur);

      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    };

    blast(now, 180, 440);
    blast(now + 0.22, 260, 392);
  } catch {
    // silencioso
  }
}

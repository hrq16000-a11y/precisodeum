/**
 * useBetDraft — persistência local do estado da Triagem (Bet Mode).
 *
 * O `BetModeShell` originalmente não persistia nada, então qualquer reload,
 * tab switch ou navegação perdia nome / WhatsApp / cidade / bairro digitados.
 *
 * Estratégia simétrica ao `useOnboardingV2Draft`:
 *  - chave única em localStorage (`bet_wizard_draft_v1`).
 *  - hidratação síncrona via initializer do `useReducer` (sem flicker).
 *  - debounce de 400ms para não bater em cada keystroke.
 *  - `clearBetDraft()` exposto para limpar ao concluir/handoff.
 */
import { useEffect, useRef } from 'react';
import { initialBetState, type BetState } from './types';
import { scheduleWizardTimeout } from '@/lib/wizardZombieGuard';

const KEY = 'bet_wizard_draft_v1';
const DEBOUNCE_MS = 400;

/** Lê o rascunho local — fail-soft, sempre retorna estado válido. */
export function loadBetDraft(): BetState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialBetState;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return initialBetState;
    // Mescla chave-a-chave para tolerar evolução do shape sem corromper.
    return { ...initialBetState, ...parsed, rewards: { ...initialBetState.rewards, ...(parsed.rewards || {}) } };
  } catch {
    return initialBetState;
  }
}

/** Limpa o rascunho — chamar ao finalizar handoff/cadastro. */
export function clearBetDraft(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

/**
 * seedBetDraftFromProfile — em modo revisão (Assistente), o Wizard pode abrir
 * direto numa fase de triagem (`triage_identity`, `triage_pro_kind`, ...).
 * BetModeShell hidrata seu estado SÍNCRONAMENTE via `loadBetDraft()` no
 * initializer do useReducer, então precisamos pré-popular o localStorage
 * ANTES dele montar com os dados reais do perfil/provider.
 *
 * Não-destrutivo: só preenche chaves vazias do draft existente.
 * Idempotente: chamar duas vezes com o mesmo seed não muda nada.
 */
export function seedBetDraftFromProfile(seed: Partial<BetState>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadBetDraft();
    const merged: BetState = { ...current };
    let changed = false;
    (Object.keys(seed) as Array<keyof BetState>).forEach((k) => {
      const cur = (current as any)[k];
      const inc = (seed as any)[k];
      const isEmpty = cur === '' || cur === null || cur === undefined ||
        (Array.isArray(cur) && cur.length === 0);
      if (isEmpty && inc !== undefined && inc !== null && inc !== '') {
        (merged as any)[k] = inc;
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(KEY, JSON.stringify(merged));
    }
  } catch { /* fail-soft */ }
}

/** Persiste o estado com debounce. Não persiste fases finais ('celebration'/'done'). */
export function useBetDraft(state: BetState) {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (state.phase === 'done' || state.phase === 'celebration') return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = scheduleWizardTimeout(
      { phase: state.phase as any, action: 'autosave_bet_local', runIfStale: true },
      () => {
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* noop */ }
      },
      DEBOUNCE_MS,
    );
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [state]);
}

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import type { ProfileWizardData, WizardMode } from '@/components/onboarding/profileWizard/types';

const DRAFT_KEY = 'wizard_draft_v1';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseWizardAutoSaveOptions {
  data: ProfileWizardData;
  mode: WizardMode;
  /** id do usuário autenticado (perfil a atualizar) */
  userId: string | undefined;
  /** Quando false, pula o UPDATE remoto e só persiste o draft local. */
  remote?: boolean;
  /** ms de debounce. Padrão 900. */
  delay?: number;
}

interface UseWizardAutoSaveResult {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  /** Limpa o draft local — chamar após finalizar o wizard com sucesso. */
  clearDraft: () => void;
}

/** Lê o draft local salvo (se houver). Útil ao montar o wizard. */
export function readWizardDraft(): Partial<ProfileWizardData> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Auto-save do wizard com debounce.
 * - Sempre persiste um draft em localStorage para sobreviver a reload.
 * - Em modo 'edit' (ou create com userId disponível) faz UPDATE silencioso
 *   nas colunas seguras de `profiles` (sem mexer em onboarding_completed).
 */
export function useWizardAutoSave({
  data,
  mode,
  userId,
  remote = true,
  delay = 900,
}: UseWizardAutoSaveOptions): UseWizardAutoSaveResult {
  const debounced = useDebounce(data, delay);
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const firstRunRef = useRef(true);

  useEffect(() => {
    // Pula a 1ª execução para evitar UPDATE imediato com dados iniciais.
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }

    let cancelled = false;

    const run = async () => {
      // 1) Draft local sempre.
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(debounced));
      } catch {
        /* quota cheia: ignora silenciosamente */
      }

      // 2) Update remoto silencioso (apenas se logado e remote=true).
      if (!remote || !userId) {
        if (!cancelled) {
          setStatus('saved');
          setLastSavedAt(new Date());
        }
        return;
      }

      try {
        if (!cancelled) setStatus('saving');
        const payload: Record<string, unknown> = {
          full_name: debounced.full_name?.trim() || undefined,
          whatsapp: debounced.whatsapp || undefined,
          bio: debounced.bio || undefined,
          city: debounced.city || undefined,
          state: debounced.state ? debounced.state.toUpperCase().slice(0, 2) : undefined,
          avatar_url: debounced.avatar_url || undefined,
        };
        // Remove undefined
        Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

        if (Object.keys(payload).length === 0) {
          if (!cancelled) setStatus('idle');
          return;
        }

        const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
        if (cancelled) return;
        if (error) {
          setStatus('error');
        } else {
          setStatus('saved');
          setLastSavedAt(new Date());
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // mode incluso para reagir a troca create/edit
  }, [debounced, mode, userId, remote]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* noop */
    }
  };

  return { status, lastSavedAt, clearDraft };
}

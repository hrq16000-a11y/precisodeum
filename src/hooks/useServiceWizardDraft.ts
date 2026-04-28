/**
 * useServiceWizardDraft — persistência de rascunho do wizard de "Meus Serviços".
 *
 * Salva (debounced) em localStorage o estado parcial do wizard quando o usuário
 * está criando um novo serviço (não em modo edição), permitindo:
 *   • Sair e voltar sem perder digitação, cidade selecionada e raio.
 *   • Manter o "Clean Final" (Step 4) coerente — service_radius + service_area.
 *   • Limpar automaticamente após publicar / cancelar explicitamente.
 *
 * Escopo: por usuário (chave inclui userId). NÃO sincroniza remoto — é apenas
 * conveniência local. Para drafts cross-device, ver `onboarding_v2_drafts`.
 */
import { useEffect, useRef } from 'react';

const STORAGE_PREFIX = 'service_wizard_draft_v1:';
const DEBOUNCE_MS = 600;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export interface ServiceWizardDraft {
  form: {
    service_name: string;
    description: string;
    price: string;
    whatsapp: string;
    service_area: string;
    address: string;
    working_hours: string;
    website: string;
    instagram_url: string;
    facebook_url: string;
    youtube_url: string;
  };
  selectedCategoryIds: string[];
  citySearch: string;
  serviceRadius: string;
  isEmergency: boolean;
  seoTags: string[];
  geoDetected: boolean;
  formStep: 1 | 2 | 3 | 4;
  savedAt: number;
}

function keyFor(userId: string | undefined | null): string | null {
  if (!userId) return null;
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadServiceWizardDraft(userId: string | undefined | null): ServiceWizardDraft | null {
  const key = keyFor(userId);
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ServiceWizardDraft;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearServiceWizardDraft(userId: string | undefined | null): void {
  const key = keyFor(userId);
  if (!key || typeof window === 'undefined') return;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/**
 * Persiste automaticamente o rascunho enquanto `enabled` for true.
 * Não persiste em modo edição (passe enabled=false).
 */
export function useServiceWizardDraftAutosave(
  userId: string | undefined | null,
  enabled: boolean,
  draft: Omit<ServiceWizardDraft, 'savedAt'>,
): void {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const key = keyFor(userId);
    if (!key) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      try {
        // Só salva se houver alguma digitação real (evita poluir storage)
        const hasContent =
          draft.form.service_name.trim().length > 0 ||
          draft.form.description.trim().length > 0 ||
          draft.selectedCategoryIds.length > 0 ||
          draft.form.service_area.trim().length > 0;
        if (!hasContent) return;
        const envelope: ServiceWizardDraft = { ...draft, savedAt: Date.now() };
        localStorage.setItem(key, JSON.stringify(envelope));
      } catch { /* quota — ignore */ }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [enabled, userId, draft]);
}

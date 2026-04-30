/**
 * Realtime de novos leads — dispara toast e contador quando um lead é INSERTed.
 * Quando o lead chega FORA do filtro atual (city/UF/categoria), o alerta
 * destaca isso para o profissional perceber oportunidades fora do recorte.
 *
 * Não duplica o refetch do useProviderLeads — apenas observa eventos de INSERT
 * e expõe o último lead novo + um contador de "fora do filtro".
 */
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { LeadContext } from '@/hooks/useLeadFollowup';
import { useLeadAlertPreference, type LeadAlertMode } from '@/hooks/useLeadAlertPreference';
import { playHornBeep } from '@/lib/soundFx';

// Som curto embutido (mesmo beep usado em DashboardLeadsPage)
const ALERT_SOUND_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';

/**
 * Resilient sound playback.
 *
 * Browser autoplay policies may block <audio> playback when there's no
 * recent user gesture. WebAudio (used by playHornBeep) tends to be more
 * permissive after the user has interacted with the page once. We try the
 * cheap data-URI beep first; on failure we fall back to the WebAudio horn.
 *
 * In all cases, the visual toast (handled by the caller) remains the
 * absolute fallback — the user always sees the alert even if every
 * sound channel is blocked.
 */
/**
 * Tenta tocar o beep e devolve uma Promise que resolve `true` se ao menos
 * uma camada (data-URI ou WebAudio) saiu — `false` se ambas foram bloqueadas
 * pelo navegador. O caller pode então acionar um fallback visual mínimo.
 */
const playSound = (): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const audio = new Audio(ALERT_SOUND_DATA_URI);
      audio.volume = 0.6;
      const result = audio.play();
      if (result && typeof result.then === 'function') {
        result
          .then(() => resolve(true))
          .catch(() => {
            try { playHornBeep(); resolve(true); } catch { resolve(false); }
          });
        return;
      }
      resolve(true);
    } catch {
      try { playHornBeep(); resolve(true); } catch { resolve(false); }
    }
  });
};

const wantsSound = (mode: LeadAlertMode) => mode === 'sound' || mode === 'both';
const wantsToast = (mode: LeadAlertMode) => mode === 'toast' || mode === 'both';

interface NewLeadPayload {
  id: string;
  client_name?: string | null;
  lead_context?: LeadContext | null;
}

interface Filters {
  city: string;        // 'all' ou label salvo
  category: string;    // 'all' ou label salvo
  uf: string;          // 'all' ou UF (2 letras)
}

const safeUF = (raw: unknown): string => {
  const s = String(raw || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : '';
};

const matchesCityLabel = (ctx: LeadContext | null | undefined, label: string): boolean => {
  if (!ctx) return false;
  const city = String(ctx.city || '').trim();
  const uf = safeUF(ctx.state);
  const composed = uf ? `${city} • ${uf}` : city;
  return composed === label || city === label;
};

export function useNewLeadAlerts(providerId: string | undefined, filters: Filters) {
  const qc = useQueryClient();
  const { mode } = useLeadAlertPreference();
  const modeRef = useRef<LeadAlertMode>(mode);
  modeRef.current = mode;
  const [outsideFilterCount, setOutsideFilterCount] = useState(0);
  const [lastNewLead, setLastNewLead] = useState<NewLeadPayload | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    if (!providerId) return;
    const channel = supabase
      .channel(`new-leads-${providerId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'leads',
        filter: `provider_id=eq.${providerId}`,
      }, (payload) => {
        const lead = payload.new as NewLeadPayload;
        setLastNewLead(lead);
        qc.invalidateQueries({ queryKey: ['provider-leads', providerId] });

        const currentMode = modeRef.current;
        if (currentMode === 'off') return; // usuário optou por silêncio total

        const f = filtersRef.current;
        const ctx = lead.lead_context;
        const cityOk = f.city === 'all' || matchesCityLabel(ctx, f.city);
        const catOk = f.category === 'all' || (String(ctx?.category || '').trim() === f.category);
        const ufOk = f.uf === 'all' || safeUF(ctx?.state) === f.uf;
        const outsideFilter = !(cityOk && catOk && ufOk);

        if (outsideFilter) setOutsideFilterCount((n) => n + 1);

        const soundRequested = wantsSound(currentMode);
        const toastRequested = wantsToast(currentMode);

        // Visual fallback ABSOLUTO: se o usuário pediu apenas som mas o
        // navegador bloqueou todas as camadas de áudio, ainda exibimos um
        // toast curto para que a notificação não passe despercebida.
        if (soundRequested) {
          void playSound().then((ok) => {
            if (!ok && !toastRequested) {
              toast('Novo lead recebido', {
                description: 'Som bloqueado pelo navegador — toque para ouvir o alerta nas próximas vezes.',
              });
            }
          });
        }
        if (!toastRequested) return;

        if (outsideFilter) {
          toast('Novo lead fora do filtro atual', {
            description: `${lead.client_name || 'Cliente'} — ${[ctx?.city, safeUF(ctx?.state)].filter(Boolean).join(' • ') || 'Origem desconhecida'}`,
            action: {
              label: 'Ver todos',
              onClick: () => {
                window.history.replaceState({}, '', window.location.pathname);
                window.location.reload();
              },
            },
          });
        } else {
          toast.success('Novo lead recebido', {
            description: lead.client_name || 'Veja na lista abaixo.',
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [providerId, qc]);

  const resetOutsideCount = () => setOutsideFilterCount(0);

  return { outsideFilterCount, lastNewLead, resetOutsideCount };
}

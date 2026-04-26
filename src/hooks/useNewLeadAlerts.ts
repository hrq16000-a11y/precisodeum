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

// Som curto embutido (mesmo beep usado em DashboardLeadsPage)
const ALERT_SOUND_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';

const playSound = () => {
  try {
    const audio = new Audio(ALERT_SOUND_DATA_URI);
    audio.volume = 0.6;
    void audio.play().catch(() => {});
  } catch {
    /* no-op */
  }
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

        const f = filtersRef.current;
        const ctx = lead.lead_context;
        const cityOk = f.city === 'all' || matchesCityLabel(ctx, f.city);
        const catOk = f.category === 'all' || (String(ctx?.category || '').trim() === f.category);
        const ufOk = f.uf === 'all' || safeUF(ctx?.state) === f.uf;
        const outsideFilter = !(cityOk && catOk && ufOk);

        if (outsideFilter) {
          setOutsideFilterCount((n) => n + 1);
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

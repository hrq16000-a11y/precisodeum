/**
 * useOnboardingV2Flag — decide se o usuário entra no novo wizard (V2) ou no Smart (V1).
 *
 * Fontes (ordem de prioridade):
 *  1. ?onboarding=v2  (override manual via URL — para QA/admin)
 *  2. ?onboarding=v1  (force opt-out)
 *  3. site_settings.onboarding_v2_enabled === 'false'  → desliga V2 globalmente (rollback)
 *  4. localStorage 'onboarding_variant' (sticky por usuário/dispositivo)
 *  5. site_settings.onboarding_v2_rollout_percent (0..100) — sorteio determinístico por user.id
 *
 * Persiste a decisão em localStorage para a mesma pessoa não trocar de fluxo no meio.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Variant = 'v1' | 'v2';
const STICKY_KEY = 'onboarding_variant';

function readQuery(): Variant | null {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('onboarding');
  if (v === 'v2' || v === 'v1') return v;
  return null;
}

/** Hash determinístico simples (string → 0..99). */
function bucket(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 100;
}

export function useOnboardingV2Flag(userId: string | undefined): {
  loading: boolean;
  variant: Variant;
} {
  const [loading, setLoading] = useState(true);
  const [variant, setVariant] = useState<Variant>('v1');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) Override por URL (sempre ganha)
      const fromQuery = readQuery();
      if (fromQuery) {
        try { localStorage.setItem(STICKY_KEY, fromQuery); } catch { /* noop */ }
        if (!cancelled) { setVariant(fromQuery); setLoading(false); }
        return;
      }

      // 2) Sticky local (decisão já tomada nesta máquina)
      let sticky: Variant | null = null;
      try {
        const v = localStorage.getItem(STICKY_KEY);
        if (v === 'v1' || v === 'v2') sticky = v;
      } catch { /* noop */ }

      // 3) Lê flags
      let enabled = true;
      let rolloutPct = 0;
      try {
        const { data } = await supabase
          .from('site_settings' as any)
          .select('key, value')
          .in('key', ['onboarding_v2_enabled', 'onboarding_v2_rollout_percent']);
        for (const row of (data || []) as any[]) {
          if (row.key === 'onboarding_v2_enabled') enabled = String(row.value) !== 'false';
          if (row.key === 'onboarding_v2_rollout_percent') rolloutPct = Math.max(0, Math.min(100, parseInt(String(row.value), 10) || 0));
        }
      } catch { /* fail-soft */ }

      // 4) Rollback global vence sticky V2
      if (!enabled) {
        try { localStorage.setItem(STICKY_KEY, 'v1'); } catch { /* noop */ }
        if (!cancelled) { setVariant('v1'); setLoading(false); }
        return;
      }

      // 5) Sticky preserva decisão anterior
      if (sticky) {
        if (!cancelled) { setVariant(sticky); setLoading(false); }
        return;
      }

      // 6) Sorteio determinístico por userId (ou random se anônimo)
      const seed = userId || `anon-${Math.random()}`;
      const chosen: Variant = bucket(seed) < rolloutPct ? 'v2' : 'v1';
      try { localStorage.setItem(STICKY_KEY, chosen); } catch { /* noop */ }
      if (!cancelled) { setVariant(chosen); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return { loading, variant };
}

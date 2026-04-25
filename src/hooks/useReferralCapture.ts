import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const REF_KEY = 'pdu_ref_code';

/**
 * Captura ?ref=CODE da URL e persiste em sessionStorage.
 * Quando o usuário estiver autenticado, tenta registrar o referral
 * via RPC register_referral. Idempotente: limpa o código após sucesso
 * (ok ou already_referred).
 */
export function useReferralCapture(userId: string | undefined) {
  // 1) captura da URL (público — antes de logar)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('ref');
      if (code && code.trim()) {
        sessionStorage.setItem(REF_KEY, code.trim());
      }
    } catch { /* silent */ }
  }, []);

  // 2) consome após login
  useEffect(() => {
    if (!userId) return;
    const code = sessionStorage.getItem(REF_KEY);
    if (!code) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('register_referral' as any, { _code: code });
        if (cancelled) return;
        if (error) {
          console.warn('[register_referral] erro', error.message);
          return;
        }
        const status = (data as any)?.status;
        if (status === 'ok' || status === 'already_referred' || status === 'self_referral_blocked') {
          sessionStorage.removeItem(REF_KEY);
        }
      } catch { /* silent */ }
    })();

    return () => { cancelled = true; };
  }, [userId]);
}

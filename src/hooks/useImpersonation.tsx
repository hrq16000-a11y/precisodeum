import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STORAGE_KEY = 'lov_impersonation_state_v1';

export interface ImpersonationState {
  sessionId: string;
  targetUserId: string;
  targetEmail: string;
  targetName?: string;
  startedAt: number;
  // Original admin session token snapshot to restore on exit
  adminSession: {
    access_token: string;
    refresh_token: string;
    user_id: string;
  };
}

function readState(): ImpersonationState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeState(s: ImpersonationState | null) {
  if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  else sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Inicia impersonation. Salva o token do admin atual no sessionStorage,
 * chama edge function `admin-impersonate`, faz verifyOtp do magiclink retornado,
 * e troca a sessão da app para o usuário-alvo.
 */
export async function startImpersonation(opts: {
  targetUserId: string;
  targetEmail: string;
  targetName?: string;
  reason?: string;
}): Promise<boolean> {
  const { data: cur } = await supabase.auth.getSession();
  if (!cur.session) {
    toast.error('Sessão de admin inválida');
    return false;
  }

  const { data, error } = await supabase.functions.invoke('admin-impersonate', {
    body: { target_user_id: opts.targetUserId, reason: opts.reason ?? null },
  });
  if (error || !data?.hashed_token) {
    toast.error(error?.message ?? 'Falha ao gerar acesso');
    return false;
  }

  // Salva estado ANTES de trocar de sessão
  const state: ImpersonationState = {
    sessionId: data.session_id,
    targetUserId: opts.targetUserId,
    targetEmail: opts.targetEmail,
    targetName: opts.targetName,
    startedAt: Date.now(),
    adminSession: {
      access_token: cur.session.access_token,
      refresh_token: cur.session.refresh_token,
      user_id: cur.session.user.id,
    },
  };
  writeState(state);

  // Troca a sessão usando o magiclink hashed_token
  const { error: vErr } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: data.hashed_token,
  });
  if (vErr) {
    writeState(null);
    toast.error('Falha ao trocar de sessão: ' + vErr.message);
    return false;
  }

  toast.success(`Acessando como ${opts.targetName ?? opts.targetEmail}`);
  // Redireciona à raiz do dashboard do usuário-alvo
  window.location.href = '/dashboard';
  return true;
}

/**
 * Encerra impersonation: restaura sessão do admin e fecha registro de auditoria.
 */
export async function stopImpersonation(): Promise<void> {
  const state = readState();
  if (!state) return;

  // Restaura sessão admin PRIMEIRO (para que a chamada de log seja feita como admin)
  const { error: setErr } = await supabase.auth.setSession({
    access_token: state.adminSession.access_token,
    refresh_token: state.adminSession.refresh_token,
  });

  if (setErr) {
    // Token pode ter expirado — força login
    writeState(null);
    toast.error('Sessão de admin expirada. Faça login novamente.');
    window.location.href = '/login';
    return;
  }

  // Encerra a sessão de impersonation no banco
  await supabase.rpc('admin_log_impersonation_end' as any, {
    _session_id: state.sessionId,
  });

  writeState(null);
  toast.success('Modo impersonation encerrado');
  window.location.href = '/admin';
}

export function useImpersonation() {
  const [state, setState] = useState<ImpersonationState | null>(() => readState());

  useEffect(() => {
    const onStorage = () => setState(readState());
    window.addEventListener('storage', onStorage);
    // Poll leve para detectar mudanças no mesmo tab
    const t = window.setInterval(() => {
      const s = readState();
      setState((prev) => (JSON.stringify(prev) === JSON.stringify(s) ? prev : s));
    }, 1000);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(t);
    };
  }, []);

  const stop = useCallback(() => stopImpersonation(), []);

  return { impersonation: state, isImpersonating: !!state, stop };
}

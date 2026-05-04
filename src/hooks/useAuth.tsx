import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { usePresenceTracker } from '@/hooks/useOnlinePresence';
import { geocodeCity } from '@/lib/geoUtils';
import { resolveCelebrationMutedPreference, setCelebrationMuted } from '@/lib/celebrate';
import { reportError } from '@/lib/errorReporter';
import { queryClient } from '@/lib/queryClient';

/**
 * Detecta de forma síncrona se há um token de sessão Supabase persistido
 * em localStorage. Usado para inicializar `loading` corretamente:
 *  - Sem token → loading=false (visitante anônimo, render imediato).
 *  - Com token → loading=true (vamos restaurar a sessão; evita redirect
 *    espúrio para /login no refresh de rota privada).
 *
 * O prefixo é derivado de VITE_SUPABASE_PROJECT_ID para nunca depender de
 * um ID hardcoded — qualquer ambiente (preview, custom domain, fork) detecta
 * o próprio token corretamente.
 */
const hasPersistedSupabaseSession = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const projectId = (import.meta as any)?.env?.VITE_SUPABASE_PROJECT_ID as string | undefined;
    if (projectId) {
      const key = `sb-${projectId}-auth-token`;
      if (window.localStorage.getItem(key)) return true;
    }
    // Fallback defensivo: varre por qualquer chave sb-*-auth-token (cobre
    // ambientes onde a env não foi injetada a tempo do bootstrap).
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) return true;
    }
  } catch {
    // localStorage pode estar bloqueado (modo privado / iframe sandbox) —
    // nesse caso assumimos visitante anônimo (loading=false).
  }
  return false;
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null;
  provider: any | null;
  loading: boolean;
  /** True when the user exists but has never explicitly chosen a profile type (social login default) */
  needsTypeSelection: boolean;
  signOut: () => Promise<void>;
  refetchProfile: () => Promise<any | null>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  provider: null,
  loading: true,
  needsTypeSelection: false,
  signOut: async () => {},
  refetchProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [provider, setProvider] = useState<any | null>(null);
  // Loading inteligente: só inicia em `true` quando há token persistido a
  // restaurar — evita o flash de redirect para /login no refresh de rotas
  // privadas (race entre primeiro render e getSession()).
  const [loading, setLoading] = useState<boolean>(() => hasPersistedSupabaseSession());
  const [needsTypeSelection, setNeedsTypeSelection] = useState(false);

  // Monotonic generation counter used to discard out-of-order fetchProfile results.
  // Every new fetch bumps this; the resolver ignores its setState writes if a
  // newer generation has started in the meantime (FIX #2 — race condition).
  const fetchGenerationRef = useRef(0);

  const fetchProfile = useCallback(async (userId: string, authUser?: User | null) => {
    // Generation guard: bumped on every call. If a newer call starts before this
    // one finishes, the older one's setState writes are silently discarded.
    const generation = ++fetchGenerationRef.current;
    const isStale = () => fetchGenerationRef.current !== generation;
    // Retry/polling: o trigger handle_new_user pode levar alguns ms após o signup.
    // Evita a race condition que deixa o usuário "preso" sem profile carregado.
    let profileData: any = null;
    let providerRows: any[] | null = null;
    const MAX_ATTEMPTS = 5;
    const PER_ATTEMPT_TIMEOUT_MS = 6000;
    const startedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    let attemptsUsed = 0;
    let lastErrorMessage: string | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      attemptsUsed = attempt + 1;
      // SEGURANÇA (PII): nunca usar select('*') aqui — colunas sensíveis
      // (tax_id, whatsapp, cpf, cnpj, phone, suspicious_ip, lat/long, postal_code,
      // street, neighborhood, complement, document, social URLs) NÃO entram no
      // estado global de auth. Quem precisar lê on-demand via query específica.
      const PROFILE_AUTH_COLUMNS =
        'id, full_name, avatar_url, profile_type, onboarding_completed, onboarding_step, ' +
        'city, state, celebration_muted, role, permissions, account_type_id, ' +
        'level_id, engagement_points, user_ref, created_at';
      try {
        // Per-attempt timeout: em mobile com rede ruim, requests do Supabase
        // podem ficar penduradas indefinidamente. Promise.race garante que
        // sempre retentamos antes de exaurir o orçamento total.
        const queryPromise = Promise.all([
          supabase.from('profiles').select(PROFILE_AUTH_COLUMNS).eq('id', userId).maybeSingle(),
          supabase.from('providers').select('*, categories(name, slug, icon)').eq('user_id', userId).order('created_at', { ascending: true }),
        ]);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`fetchProfile attempt ${attemptsUsed} timed out after ${PER_ATTEMPT_TIMEOUT_MS}ms`)), PER_ATTEMPT_TIMEOUT_MS),
        );
        const [{ data: pData, error: pErr }, { data: pvRows, error: pvErr }] = await Promise.race([queryPromise, timeoutPromise]);
        if (pErr) {
          lastErrorMessage = `profiles: ${pErr.message ?? String(pErr)}`;
          console.warn('[useAuth] profiles query error', pErr);
        }
        if (pvErr) {
          lastErrorMessage = `providers: ${pvErr.message ?? String(pvErr)}`;
          console.warn('[useAuth] providers query error', pvErr);
        }
        let derivedAccountType: string | null = null;
        let derivedPrimaryCategoryId: string | null = null;
        if (Array.isArray(pvRows) && pvRows.length > 0) {
          derivedAccountType = String(
            pvRows.find((row: any) => row?.account_type)?.account_type ?? pvRows[0]?.account_type ?? '',
          ).trim() || null;
          derivedPrimaryCategoryId = String(
            pvRows.find((row: any) => row?.category_id)?.category_id ?? pvRows[0]?.category_id ?? '',
          ).trim() || null;
        }
        profileData = pData && typeof pData === 'object'
          ? {
              ...(pData as Record<string, unknown>),
              account_type: (pData as any)?.account_type ?? derivedAccountType,
              primary_category_id: (pData as any)?.primary_category_id ?? derivedPrimaryCategoryId,
            }
          : pData;
        providerRows = pvRows;
        if (profileData) break;
      } catch (err: any) {
        lastErrorMessage = err?.message ?? String(err);
        console.warn(`[useAuth] fetchProfile attempt ${attemptsUsed} failed:`, err);
      }
      // Backoff curto: 200ms, 400ms, 800ms, 1600ms (total ~3s + ~6s timeout * tentativas)
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise(resolve => setTimeout(resolve, 200 * Math.pow(2, attempt)));
      }
    }

    const elapsedMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt);
    // Fire-and-forget telemetry
    supabase.from('auth_profile_metrics' as any).insert({
      user_id: userId,
      duration_ms: elapsedMs,
      attempts: attemptsUsed,
      succeeded: !!profileData,
    } as any).then(() => undefined, () => undefined);

    if (!profileData) {
      reportError({
        errorMessage: `Profile fetch timeout after ${MAX_ATTEMPTS} attempts (${elapsedMs}ms)${lastErrorMessage ? ` — last error: ${lastErrorMessage}` : ''}`,
        componentName: 'useAuth',
        actionContext: 'auth.profile_timeout',
        severity: 'error',
      }).catch((err) => {
        // Telemetria de telemetria — só log; não exibimos toast pra evitar loop.
        console.warn('[useAuth] reportError(profile_timeout) failed', err);
      });
    }


    if (isStale()) return profileData ?? null;
    setProfile(profileData);
    if (isStale()) return profileData ?? null;
    setCelebrationMuted(resolveCelebrationMutedPreference(profileData?.celebration_muted));

    const metaChosen = authUser?.user_metadata?.profile_type_chosen === true;
    const hasType = !!profileData?.profile_type;
    // Só força o wizard quando NÃO existe profile_type no banco.
    // Se já tem tipo gravado mas a flag de metadata está ausente (contas antigas / OAuth),
    // sincroniza silenciosamente — sem reabrir o wizard.
    if (isStale()) return profileData ?? null;
    setNeedsTypeSelection(!!profileData && !hasType);
    if (hasType && !metaChosen) {
      supabase.auth.updateUser({ data: { profile_type_chosen: true } }).catch((err) => {
        // Sync silencioso de metadata — não bloqueia UX, mas registramos
        // para auditoria caso o auth.updateUser falhe sistematicamente.
        console.warn('[useAuth] auth.updateUser(profile_type_chosen) failed', err);
      });
    }

    if (providerRows && providerRows.length > 0) {
      const best = providerRows.find(p => p.city && p.description) || providerRows[0];
      if (!isStale()) setProvider(best);

      if (best.city && best.city !== 'Não informada' && best.state && (best.latitude == null || best.longitude == null)) {
        window.setTimeout(() => {
          geocodeCity(best.city, best.state)
            .then(({ latitude, longitude }) => {
              if (latitude != null && longitude != null) {
                supabase.from('providers').update({ latitude, longitude }).eq('id', best.id).then(() => {
                  if (!isStale()) setProvider(prev => prev ? { ...prev, latitude, longitude } : prev);
                });
              }
            })
            .catch((err) => {
              // Geocode best-effort — não bloqueia o login, mas logamos
              // para detectar quedas sistemáticas do provedor de geocoding.
              console.warn('[useAuth] geocodeCity background update failed', err);
            });
        }, 1200);
      }
    } else {
      if (!isStale()) setProvider(null);
    }

    return profileData ?? null;
  }, []);

  const refetchProfile = useCallback(async () => {
    if (!user) return null;

    const { data: authData } = await supabase.auth.getUser();

    const freshUser = authData.user ?? user;
    if (freshUser !== user) setUser(freshUser);

    // fetchProfile já recalcula needsTypeSelection com base no banco — não forçar false aqui.
    const freshProfile = await fetchProfile(user.id, freshUser);
    return freshProfile ?? null;
  }, [user, fetchProfile]);

  useEffect(() => {
    // [FIX #2 — Race Condition Guard]
    // `isMounted` impede que callbacks atrasados de auth/fetchProfile escrevam
    // estado depois do unmount. O cancelamento por geração já vive dentro de
    // `fetchProfile` (fetchGenerationRef) — aqui cuidamos apenas das writes
    // do próprio efeito (setSession/setUser/setLoading).
    let isMounted = true;

    // [TELEMETRIA] Tempo até `loading=false` (boot do auth) e contagem de
    // ocorrências de "Lock broken" do navigatorLock. Best-effort, fail-soft.
    const authBootStartedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    let bootResolved = false;
    let lockBrokenCount = 0;
    const reportAuthBoot = (outcome: 'resolved' | 'watchdog_forced' | 'no_session') => {
      if (bootResolved) return;
      bootResolved = true;
      const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - authBootStartedAt);
      try {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        const env = /lovable\.app$/i.test(host)
          ? 'preview'
          : (host === 'localhost' || host === '127.0.0.1' ? 'development' : 'production');
        supabase.from('auth_profile_metrics' as any).insert({
          user_id: (typeof window !== 'undefined' ? null : null),
          duration_ms: ms,
          attempts: 0,
          succeeded: outcome === 'resolved' || outcome === 'no_session',
          outcome,
          lock_broken_count: lockBrokenCount,
          environment: env,
        } as any).then(() => undefined, () => undefined);
      } catch { /* noop */ }
      if (outcome === 'watchdog_forced' || lockBrokenCount > 0) {
        console.warn('[useAuth] boot telemetry', { outcome, ms, lockBrokenCount });
      }
    };

    // [FIX — White Screen Watchdog]
    // Caso `getSession()` ou `fetchProfile()` fiquem pendentes (Lock broken
    // do navigatorLock, refresh token preso, rede 3G muito lenta), garantimos
    // que `loading` flipa para `false` em no máximo 8s. Sem isso, gates como
    // /cadastro-inicial ficam em skeleton infinito → tela branca.
    const watchdog = window.setTimeout(() => {
      if (!isMounted) return;
      setLoading((prev) => {
        if (prev) {
          console.warn('[useAuth] watchdog: forçando loading=false após 8s pendente');
          reportAuthBoot('watchdog_forced');
        }
        return false;
      });
    }, 8000);

    // [FIX — Lock broken benigno]
    // O Supabase auto-refresh usa navigator.locks com option 'steal'. Quando
    // outra aba/SW rouba o lock, o Promise interno rejeita com AbortError.
    // É esperado e não deve poluir o ErrorGuard global. Suprimimos só esse
    // caso específico — qualquer outra rejection segue o fluxo normal.
    const onUnhandledRejection = (ev: PromiseRejectionEvent) => {
      const msg = String((ev.reason as any)?.message || ev.reason || '');
      if (/Lock broken by another request|navigatorLock/i.test(msg)) {
        lockBrokenCount += 1;
        ev.preventDefault();
        // Eventos pontuais (1º e múltiplos de 5) viram log para auditoria.
        if (lockBrokenCount === 1 || lockBrokenCount % 5 === 0) {
          console.warn('[useAuth] navigatorLock broken (benign)', { count: lockBrokenCount });
        }
      }
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Background fetch — fetchProfile internamente descarta resultados
          // obsoletos via fetchGenerationRef, então múltiplos eventos rápidos
          // (SIGNED_IN → TOKEN_REFRESHED) só aplicam o último.
          setTimeout(() => {
            if (!isMounted) return;
            try {
              void fetchProfile(session.user.id, session.user).catch((err) => {
                console.error('[useAuth] fetchProfile failed:', err);
              });
            } catch (err) {
              console.error('[useAuth] fetchProfile threw:', err);
            }
          }, 0);
          if (event === 'SIGNED_IN') {
            setTimeout(() => {
              supabase.functions.invoke('log-user-access', {
                body: { event_type: 'login', source: 'web' },
              }).catch(() => {/* silent */});
            }, 500);
          }
        } else {
          setProfile(null);
          setProvider(null);
          setCelebrationMuted(false);
          setNeedsTypeSelection(false);
          setLoading(false);
        }
      }
    );

    // [FIX #1 — Safety Timer removido]
    // O loading global agora SÓ flipa para false quando getSession()/fetchProfile()
    // realmente resolverem ou rejeitarem. Sem timer arbitrário de 3s para evitar
    // o estado fantasma `user && !profile && !loading`.
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setLoading(true);
          fetchProfile(session.user.id, session.user)
            .catch((err) => console.error('[useAuth] initial fetchProfile failed:', err))
            .finally(() => {
              if (!isMounted) return;
              setLoading(false);
              reportAuthBoot('resolved');
            });
        } else {
          setLoading(false);
          reportAuthBoot('no_session');
        }
      })
      .catch((err) => {
        console.error('[useAuth] getSession failed:', err);
        if (!isMounted) return;
        setLoading(false);
        reportAuthBoot('no_session');
      });

    return () => {
      isMounted = false;
      window.clearTimeout(watchdog);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  useEffect(() => {
    if (!user?.id) return;

    const syncMutedFromProfile = (nextProfile: any) => {
      setProfile(prev => ({ ...(prev ?? {}), ...(nextProfile ?? {}) }));
      setCelebrationMuted(resolveCelebrationMutedPreference(nextProfile?.celebration_muted));
    };

    const channel = supabase
      .channel(`profile-preferences:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => syncMutedFromProfile(payload.new)
      )
      .subscribe();

    let visibilityTimer: number | null = null;
    const refreshOnFocus = () => {
      if (document.visibilityState !== 'visible') return;
      // Debounce: rapid alt-tab / tab switches should result in a single refetch.
      if (visibilityTimer != null) window.clearTimeout(visibilityTimer);
      visibilityTimer = window.setTimeout(() => {
        visibilityTimer = null;
        void refetchProfile();
      }, 500);
    };
    document.addEventListener('visibilitychange', refreshOnFocus);

    return () => {
      if (visibilityTimer != null) window.clearTimeout(visibilityTimer);
      document.removeEventListener('visibilitychange', refreshOnFocus);
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetchProfile]);

  const signOut = useCallback(async () => {
    // 1) Encerra a sessão no Supabase (revoga refresh token + limpa storage sb-*).
    try {
      await supabase.auth.signOut();
    } catch (err) {
      // Mesmo com falha de rede limpamos estado local — token expira sozinho.
      console.warn('[useAuth] signOut(): supabase.auth.signOut falhou, limpando local mesmo assim', err);
    }

    // 2) Reset de estado de auth em memória.
    setSession(null);
    setUser(null);
    setProfile(null);
    setProvider(null);
    setCelebrationMuted(false);
    setNeedsTypeSelection(false);

    // 3) Cache do React Query — vital para impedir vazamento de PII (leads,
    //    notificações, perfil, mensagens) em dispositivos compartilhados.
    try {
      queryClient.cancelQueries();
      queryClient.clear();
    } catch (err) {
      console.warn('[useAuth] signOut(): queryClient.clear falhou', err);
    }

    // 4) sessionStorage — limpa estados temporários (impersonação, drafts de
    //    fluxos sensíveis, telemetria de funil). localStorage é preservado
    //    para manter preferências persistidas (consent LGPD, tema, etc.).
    try {
      if (typeof window !== 'undefined') {
        const ss = window.sessionStorage;
        // Remove explicitamente chaves de impersonação/admin que NUNCA podem
        // sobreviver a um logout, mesmo que o clear() abaixo falhe.
        const sensitiveKeys = [
          'impersonation_admin_token',
          'impersonation_admin_refresh',
          'impersonation_session_id',
          'impersonation_target_user',
        ];
        for (const k of sensitiveKeys) {
          try { ss.removeItem(k); } catch { /* noop */ }
        }
        try { ss.clear(); } catch { /* noop */ }
      }
    } catch (err) {
      console.warn('[useAuth] signOut(): sessionStorage.clear falhou', err);
    }
  }, []);
  // Track online presence for the current user, including their city
  const providerCity = provider?.city;
  const presenceMeta = useMemo(() => (providerCity ? { city: providerCity } : undefined), [providerCity]);
  usePresenceTracker(user?.id, presenceMeta);

  // Memoize the context value so consumers (~50+ across the app) don't re-render
  // unless one of the actual primitives changes. Without this, every parent
  // re-render of AuthProvider cascaded a re-render to every `useAuth()` consumer.
  const contextValue = useMemo<AuthContextType>(
    () => ({ session, user, profile, provider, loading, needsTypeSelection, signOut, refetchProfile }),
    [session, user, profile, provider, loading, needsTypeSelection, signOut, refetchProfile],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

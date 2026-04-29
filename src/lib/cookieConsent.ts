// Gerenciamento de consentimento de cookies (LGPD)
// Persiste preferências por categoria no localStorage, dispara eventos
// para os módulos de analytics/ads consultarem em tempo real, e registra
// auditoria no banco (cookie_consent_log) por user_id e versão.

import { supabase } from "@/integrations/supabase/client";

export type ConsentCategory = "essential" | "functional" | "analytics" | "marketing";

export type ConsentState = {
  essential: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  version: number;
  updated_at: string;
};

const STORAGE_KEY = "cookie_consent_v2";
const ANON_ID_KEY = "cookie_consent_anon_id";
const LEGACY_KEY = "cookie_consent_accepted";
const CURRENT_VERSION = 1;
const EVENT_NAME = "cookie-consent-changed";

export const DEFAULT_CONSENT: ConsentState = {
  essential: true,
  functional: false,
  analytics: false,
  marketing: false,
  version: CURRENT_VERSION,
  updated_at: new Date(0).toISOString(),
};

export function getConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== CURRENT_VERSION) return null;
    return { ...DEFAULT_CONSENT, ...parsed, essential: true };
  } catch {
    return null;
  }
}

/**
 * Hidrata o consentimento a partir do servidor para usuários logados.
 *
 * Garante que o banner "Sua privacidade importa" apareça apenas UMA vez por
 * usuário — mesmo após limpeza de cache, troca de dispositivo ou nova versão
 * do app. Se já existe um log mais recente no banco e o localStorage está
 * vazio, restauramos a preferência (sem registrar novo evento de auditoria).
 *
 * Best-effort: nunca lança e nunca bloqueia o render.
 */
export async function hydrateConsentFromServer(): Promise<ConsentState | null> {
  if (typeof window === "undefined") return null;
  // Se já temos consent local, nada a fazer.
  if (getConsent()) return getConsent();
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return null;
    const { data, error } = await supabase
      .from("cookie_consent_log" as any)
      .select("functional, analytics, marketing, version, created_at")
      .eq("user_id", userId)
      .eq("version", CURRENT_VERSION)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as {
      functional: boolean;
      analytics: boolean;
      marketing: boolean;
      version: number;
      created_at: string;
    };
    const restored: ConsentState = {
      essential: true,
      functional: !!row.functional,
      analytics: !!row.analytics,
      marketing: !!row.marketing,
      version: CURRENT_VERSION,
      updated_at: row.created_at || new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: restored }));
    } catch {
      /* ignore */
    }
    return restored;
  } catch {
    return null;
  }
}

function getOrCreateAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return `anon_${Date.now()}`;
  }
}

export function saveConsent(
  partial: Partial<Omit<ConsentState, "essential" | "version" | "updated_at">>,
  source: "banner" | "pagina_cookies" | "api" = "banner",
) {
  const previous = getConsent();
  const state: ConsentState = {
    ...DEFAULT_CONSENT,
    ...previous,
    ...partial,
    essential: true,
    version: CURRENT_VERSION,
    updated_at: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.removeItem(LEGACY_KEY);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: state }));
  } catch {
    // ignore quota
  }

  // Auditoria no banco — best-effort, não bloqueia a UI
  void recordConsentLog(state, source);

  // Detecta revogações (true → false) de marketing/analytics e dispara
  // notificação admin (best-effort).
  const revoked: ConsentCategory[] = [];
  (["analytics", "marketing", "functional"] as const).forEach((cat) => {
    const wasOn = !!previous && previous[cat] === true;
    const isOff = state[cat] === false;
    if (wasOn && isOff) revoked.push(cat);
  });
  if (revoked.length > 0) {
    void recordConsentRevocation(state, previous, revoked, source);
  }

  return state;
}

async function recordConsentLog(state: ConsentState, source: string) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user_id = sessionData.session?.user?.id ?? null;
    const anon_id = getOrCreateAnonId();
    await supabase.from("cookie_consent_log" as any).insert({
      user_id,
      anon_id,
      version: state.version,
      essential: state.essential,
      functional: state.functional,
      analytics: state.analytics,
      marketing: state.marketing,
      source,
      user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
  } catch (e) {
    // silencioso — auditoria não pode bloquear o fluxo
    if (typeof console !== "undefined") console.warn("[consent] log failed", e);
  }
}

async function recordConsentRevocation(
  state: ConsentState,
  previous: ConsentState | null,
  revoked: ConsentCategory[],
  source: string,
) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user_id = sessionData.session?.user?.id ?? null;
    const anon_id = getOrCreateAnonId();
    await supabase.from("consent_revocations" as any).insert({
      user_id,
      anon_id,
      version: state.version,
      revoked_categories: revoked,
      previous_state: previous
        ? {
            functional: previous.functional,
            analytics: previous.analytics,
            marketing: previous.marketing,
          }
        : null,
      current_state: {
        functional: state.functional,
        analytics: state.analytics,
        marketing: state.marketing,
      },
      source,
      user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
  } catch (e) {
    if (typeof console !== "undefined") console.warn("[consent] revocation log failed", e);
  }
}

export function acceptAll(source: "banner" | "pagina_cookies" | "api" = "banner") {
  return saveConsent({ functional: true, analytics: true, marketing: true }, source);
}

export function rejectAll(source: "banner" | "pagina_cookies" | "api" = "banner") {
  return saveConsent({ functional: false, analytics: false, marketing: false }, source);
}

export function hasConsent(category: ConsentCategory): boolean {
  if (category === "essential") return true;
  const c = getConsent();
  return !!c && c[category] === true;
}

export function onConsentChange(handler: (state: ConsentState) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<ConsentState>).detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

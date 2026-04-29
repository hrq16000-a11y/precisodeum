// Gerenciamento de consentimento de cookies (LGPD)
// Persiste preferências por categoria no localStorage e dispara eventos
// para os módulos de analytics/ads consultarem antes de inicializar.

export type ConsentCategory = "essential" | "functional" | "analytics" | "marketing";

export type ConsentState = {
  essential: true; // sempre true (necessário para o site funcionar)
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  version: number;
  updated_at: string;
};

const STORAGE_KEY = "cookie_consent_v2";
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

export function saveConsent(partial: Partial<Omit<ConsentState, "essential" | "version" | "updated_at">>) {
  const state: ConsentState = {
    ...DEFAULT_CONSENT,
    ...getConsent(),
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
  return state;
}

export function acceptAll() {
  return saveConsent({ functional: true, analytics: true, marketing: true });
}

export function rejectAll() {
  return saveConsent({ functional: false, analytics: false, marketing: false });
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

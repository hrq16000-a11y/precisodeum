// Bridge entre o consentimento de cookies (LGPD) e os módulos analytics/marketing.
// Em tempo real (sem reload), ativa/desativa Google Analytics, Meta Pixel
// e qualquer outro pixel via flags `__consent_*` que os scripts podem checar.

import { getConsent, onConsentChange, type ConsentState } from "./cookieConsent";

declare global {
  interface Window {
    __consent_analytics?: boolean;
    __consent_marketing?: boolean;
    __consent_functional?: boolean;
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

const GA_IDS_TO_DISABLE = ["G-XXXXXXX"]; // sobrescrito via window.GA_MEASUREMENT_IDS se necessário

function applyState(state: ConsentState) {
  if (typeof window === "undefined") return;

  // Flags globais consultadas pelos pixels antes de disparar
  window.__consent_functional = state.functional;
  window.__consent_analytics = state.analytics;
  window.__consent_marketing = state.marketing;

  // Google Analytics — modo Consent v2
  try {
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage: state.analytics ? "granted" : "denied",
        ad_storage: state.marketing ? "granted" : "denied",
        ad_user_data: state.marketing ? "granted" : "denied",
        ad_personalization: state.marketing ? "granted" : "denied",
        functionality_storage: state.functional ? "granted" : "denied",
        personalization_storage: state.functional ? "granted" : "denied",
      });
    }
    // Kill-switch oficial do GA via window['ga-disable-<ID>']
    const ids: string[] =
      (window as any).GA_MEASUREMENT_IDS && Array.isArray((window as any).GA_MEASUREMENT_IDS)
        ? (window as any).GA_MEASUREMENT_IDS
        : GA_IDS_TO_DISABLE;
    for (const id of ids) {
      (window as any)[`ga-disable-${id}`] = !state.analytics;
    }
  } catch {
    /* noop */
  }

  // Meta Pixel — Consent Mode
  try {
    if (typeof window.fbq === "function") {
      window.fbq("consent", state.marketing ? "grant" : "revoke");
    }
  } catch {
    /* noop */
  }

  // Limpa cookies de marketing/analytics caso tenham sido revogados
  if (!state.marketing) clearCookiesByPrefix(["_fbp", "_fbc", "_gcl_", "_uetsid", "_uetvid"]);
  if (!state.analytics) clearCookiesByPrefix(["_ga", "_gid", "_gat", "_dc_gtm_"]);
}

function clearCookiesByPrefix(prefixes: string[]) {
  if (typeof document === "undefined") return;
  try {
    const all = document.cookie.split(";").map((c) => c.trim().split("=")[0]).filter(Boolean);
    const host = location.hostname;
    const rootDomain = host.split(".").slice(-2).join(".");
    for (const name of all) {
      if (prefixes.some((p) => name.startsWith(p))) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${host}`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${rootDomain}`;
      }
    }
  } catch {
    /* noop */
  }
}

let installed = false;
export function installConsentBridge() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Estado inicial
  const current = getConsent();
  if (current) {
    applyState(current);
  } else {
    applyState({
      essential: true,
      functional: false,
      analytics: false,
      marketing: false,
      version: 1,
      updated_at: new Date(0).toISOString(),
    } as ConsentState);
  }

  // Reage em tempo real a mudanças
  onConsentChange(applyState);
}

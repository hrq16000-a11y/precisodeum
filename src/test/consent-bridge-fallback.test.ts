// Garante que o consentBridge é tolerante a ausência de gtag/fbq:
// o estado interno (window.__consent_*) e os listeners precisam continuar
// funcionando mesmo quando os scripts de marketing/analytics não estão
// carregados (rede lenta, bloqueador de anúncios, etc.).
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    from: () => ({ insert: vi.fn().mockResolvedValue({ data: null, error: null }) }),
  },
}));

describe("consentBridge — fallback sem gtag/fbq", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    delete (window as any).gtag;
    delete (window as any).fbq;
    delete (window as any).__consent_analytics;
    delete (window as any).__consent_marketing;
    delete (window as any).__consent_functional;
  });

  it("não lança quando gtag e fbq estão ausentes", async () => {
    const { installConsentBridge } = await import("@/lib/consentBridge");
    const { saveConsent, acceptAll, rejectAll } = await import("@/lib/cookieConsent");

    expect(() => installConsentBridge()).not.toThrow();
    expect(() => saveConsent({ analytics: true, marketing: true }, "banner")).not.toThrow();
    expect(() => acceptAll("banner")).not.toThrow();
    expect(() => rejectAll("banner")).not.toThrow();
  });

  it("atualiza window.__consent_* mesmo sem gtag/fbq", async () => {
    const { installConsentBridge } = await import("@/lib/consentBridge");
    const { saveConsent } = await import("@/lib/cookieConsent");
    installConsentBridge();

    saveConsent({ functional: true, analytics: true, marketing: false }, "banner");

    expect(window.__consent_functional).toBe(true);
    expect(window.__consent_analytics).toBe(true);
    expect(window.__consent_marketing).toBe(false);
  });

  it("não trava quando gtag lança exceção", async () => {
    (window as any).gtag = () => { throw new Error("simulated"); };
    const { installConsentBridge } = await import("@/lib/consentBridge");
    const { saveConsent } = await import("@/lib/cookieConsent");
    installConsentBridge();
    expect(() => saveConsent({ analytics: true }, "banner")).not.toThrow();
    expect(window.__consent_analytics).toBe(true);
  });

  it("não trava quando fbq lança exceção", async () => {
    (window as any).fbq = () => { throw new Error("simulated"); };
    const { installConsentBridge } = await import("@/lib/consentBridge");
    const { saveConsent } = await import("@/lib/cookieConsent");
    installConsentBridge();
    expect(() => saveConsent({ marketing: true }, "banner")).not.toThrow();
    expect(window.__consent_marketing).toBe(true);
  });

  it("dispatcha evento cookie-consent-changed sempre, independente de gtag", async () => {
    await import("@/lib/consentBridge").then((m) => m.installConsentBridge());
    const { saveConsent } = await import("@/lib/cookieConsent");
    let received: any = null;
    window.addEventListener("cookie-consent-changed", (e: Event) => {
      received = (e as CustomEvent).detail;
    });
    saveConsent({ analytics: true }, "banner");
    expect(received).toBeTruthy();
    expect(received.analytics).toBe(true);
  });
});

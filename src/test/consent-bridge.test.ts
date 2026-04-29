// Testes do consent bridge: aplica state em window.__consent_* em tempo real
// e dispara gtag/fbq com os valores corretos quando o estado muda.
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    from: () => ({ insert: vi.fn().mockResolvedValue({ data: null, error: null }) }),
  },
}));

describe("consentBridge — aplicação em tempo real", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    delete (window as any).__consent_analytics;
    delete (window as any).__consent_marketing;
    delete (window as any).__consent_functional;
  });

  it("instala flags iniciais como false quando não há consentimento salvo", async () => {
    const { installConsentBridge } = await import("@/lib/consentBridge");
    installConsentBridge();
    expect(window.__consent_analytics).toBe(false);
    expect(window.__consent_marketing).toBe(false);
    expect(window.__consent_functional).toBe(false);
  });

  it("reage ao saveConsent sem reload e dispara gtag consent.update", async () => {
    const gtag = vi.fn();
    (window as any).gtag = gtag;
    (window as any).GA_MEASUREMENT_IDS = ["G-TEST"];

    const { installConsentBridge } = await import("@/lib/consentBridge");
    const { saveConsent } = await import("@/lib/cookieConsent");
    installConsentBridge();

    saveConsent({ functional: true, analytics: true, marketing: false }, "banner");

    expect(window.__consent_analytics).toBe(true);
    expect(window.__consent_marketing).toBe(false);
    expect(window.__consent_functional).toBe(true);
    expect(gtag).toHaveBeenCalledWith(
      "consent",
      "update",
      expect.objectContaining({
        analytics_storage: "granted",
        ad_storage: "denied",
      }),
    );
    // kill-switch GA aplicado
    expect((window as any)["ga-disable-G-TEST"]).toBe(false);
  });

  it("revoga marketing aplica fbq consent revoke imediatamente", async () => {
    const fbq = vi.fn();
    (window as any).fbq = fbq;

    const { installConsentBridge } = await import("@/lib/consentBridge");
    const { acceptAll, rejectAll } = await import("@/lib/cookieConsent");
    installConsentBridge();

    acceptAll("banner");
    expect(fbq).toHaveBeenCalledWith("consent", "grant");

    rejectAll("banner");
    expect(fbq).toHaveBeenLastCalledWith("consent", "revoke");
    expect(window.__consent_marketing).toBe(false);
  });
});

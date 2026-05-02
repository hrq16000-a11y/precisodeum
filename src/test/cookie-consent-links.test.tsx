// Verifica que os links do banner e da página /cookies apontam para
// destinos corretos e que a UI reflete o estado salvo no banco.
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    from: () => ({ insert: vi.fn().mockResolvedValue({ data: null, error: null }) }),
  },
}));

import CookieConsent from "@/components/CookieConsent";

const renderInRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Banner /cookies — links e URLs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("banner exibe link para /cookies (Política de Cookies)", async () => {
    renderInRouter(<CookieConsent />);
    // Aguarda o effect async (hydrateConsentFromServer) resolver e o banner aparecer.
    const cookiesLinks = await screen.findAllByRole("link", { name: /cookies|privacidade|preferências/i });
    const hrefs = cookiesLinks.map((a) => a.getAttribute("href"));
    expect(hrefs.some((h) => h === "/cookies" || h === "/privacidade")).toBe(true);
  });

  it("links do banner não apontam para domínios externos não esperados", async () => {
    renderInRouter(<CookieConsent />);
    await screen.findAllByRole("link", { name: /cookies|privacidade/i });
    const links = screen.queryAllByRole("link");
    for (const a of links) {
      const href = a.getAttribute("href") || "";
      // tudo do banner deve ser interno (rota relativa) ou âncora
      expect(href.startsWith("http://") || href.startsWith("https://")).toBe(false);
    }
  });
});

describe("Estado salvo reflete no comportamento", () => {
  beforeEach(() => { localStorage.clear(); });

  it("hasConsent reflete o que foi gravado em saveConsent", async () => {
    const { saveConsent, hasConsent } = await import("@/lib/cookieConsent");
    saveConsent({ analytics: true, marketing: false }, "banner");
    expect(hasConsent("analytics")).toBe(true);
    expect(hasConsent("marketing")).toBe(false);
    expect(hasConsent("essential")).toBe(true);
  });

  it("getConsent retorna null quando não existe consentimento (default deny)", async () => {
    const { getConsent, hasConsent } = await import("@/lib/cookieConsent");
    expect(getConsent()).toBeNull();
    expect(hasConsent("analytics")).toBe(false);
    expect(hasConsent("marketing")).toBe(false);
  });

  it("acceptAll grava todas as categorias e rejectAll mantém só essential", async () => {
    const { acceptAll, rejectAll, getConsent } = await import("@/lib/cookieConsent");
    acceptAll("banner");
    let s = getConsent();
    expect(s).toBeTruthy();
    expect(s!.analytics).toBe(true);
    expect(s!.marketing).toBe(true);
    expect(s!.functional).toBe(true);
    expect(s!.essential).toBe(true);

    rejectAll("banner");
    s = getConsent();
    expect(s!.analytics).toBe(false);
    expect(s!.marketing).toBe(false);
    expect(s!.functional).toBe(false);
    expect(s!.essential).toBe(true);
  });
});

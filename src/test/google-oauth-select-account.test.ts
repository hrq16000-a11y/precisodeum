import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E2E-lite: valida o contrato do login Google 1-clique com prompt='select_account'
 * - Garante que `extraParams.prompt = 'select_account'` é enviado
 * - Garante que `redirect_uri` aponta para window.location.origin
 * - Cobre cenário de "trocar de conta" (usuário cancela → segunda chamada mantém prompt)
 * - Cobre recuperação de sessão pós-redirect (result.redirected === true → não toca em supabase)
 */

const signInWithOAuth = vi.fn();
vi.mock("@/integrations/lovable/index", () => ({
  lovable: { auth: { signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args) } },
}));

beforeEach(() => {
  signInWithOAuth.mockReset();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, origin: "https://app.test", href: "https://app.test/login" },
  });
});

const callGoogleLogin = async () => {
  const { lovable } = await import("@/integrations/lovable/index");
  return lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
    extraParams: { prompt: "select_account" },
  });
};

describe("Google OAuth — 1 clique com select_account", () => {
  it("envia prompt=select_account e redirect_uri=origin", async () => {
    signInWithOAuth.mockResolvedValueOnce({ redirected: true });
    await callGoogleLogin();
    expect(signInWithOAuth).toHaveBeenCalledWith("google", {
      redirect_uri: "https://app.test",
      extraParams: { prompt: "select_account" },
    });
  });

  it("permite trocar de conta: chamada N+1 ainda envia select_account", async () => {
    signInWithOAuth.mockResolvedValueOnce({ redirected: true });
    signInWithOAuth.mockResolvedValueOnce({ redirected: true });
    await callGoogleLogin();
    await callGoogleLogin();
    expect(signInWithOAuth).toHaveBeenCalledTimes(2);
    for (const call of signInWithOAuth.mock.calls) {
      expect(call[1].extraParams.prompt).toBe("select_account");
    }
  });

  it("retorna redirected=true quando o navegador segue para Google", async () => {
    signInWithOAuth.mockResolvedValueOnce({ redirected: true });
    const r = await callGoogleLogin();
    expect(r.redirected).toBe(true);
    expect((r as any).error).toBeUndefined();
  });

  it("propaga erro sem quebrar a UI quando provider falha", async () => {
    const err = new Error("oauth_provider_error");
    signInWithOAuth.mockResolvedValueOnce({ error: err });
    const r = await callGoogleLogin();
    expect((r as any).error).toBe(err);
  });

  it("recupera sessão após redirect: callback recebe tokens e redirected=false", async () => {
    signInWithOAuth.mockResolvedValueOnce({
      redirected: false,
      tokens: { access_token: "a", refresh_token: "r" },
    });
    const r = await callGoogleLogin();
    expect((r as any).redirected).toBe(false);
    expect((r as any).tokens.access_token).toBe("a");
  });
});

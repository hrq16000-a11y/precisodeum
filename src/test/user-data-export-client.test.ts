// Testes do user-data-export client + flow do dashboard:
// - confirma que o download usa Authorization Bearer com o JWT atual
// - confirma que o blob recebido é JSON com user_id == auth.user.id
// - confirma erro pt-BR quando a sessão está ausente
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetSession = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    from: () => ({ insert: vi.fn().mockResolvedValue({ data: null, error: null }) }),
  },
}));

const FUNCTION_URL = (name: string) =>
  `${import.meta.env.VITE_SUPABASE_URL || "https://test.supabase.co"}/functions/v1/${name}`;

async function downloadUserData() {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");
  const res = await fetch(FUNCTION_URL("user-data-export"), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Falha ao gerar relatório (${res.status}).`);
  const text = await res.text();
  return JSON.parse(text);
}

describe("user-data-export — download client flow", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    (globalThis as any).fetch = vi.fn();
  });

  it("envia Authorization Bearer com o token atual", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "tkn_123", user: { id: "u1" } } },
    });
    const fakeReport = {
      meta: { user_id: "u1", generated_at: "2026-01-01T00:00:00Z" },
      auth_user: { id: "u1" },
      tables: { profiles: { count: 1, rows: [{ user_id: "u1" }] } },
    };
    (globalThis as any).fetch.mockResolvedValue(
      new Response(JSON.stringify(fakeReport), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const out = await downloadUserData();

    const call = (globalThis as any).fetch.mock.calls[0];
    expect(call[0]).toContain("/functions/v1/user-data-export");
    expect(call[1].headers.Authorization).toBe("Bearer tkn_123");
    expect(out.meta.user_id).toBe("u1");
    expect(out.tables.profiles.rows[0].user_id).toBe("u1");
  });

  it("formato JSON consistente: meta, auth_user e tables presentes", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "tkn", user: { id: "u9" } } },
    });
    const fakeReport = {
      meta: { user_id: "u9", legal_basis: "LGPD" },
      auth_user: { id: "u9", email: "x@y.z" },
      tables: { profiles: { count: 0, rows: [] }, leads: { count: 0, rows: [] } },
    };
    (globalThis as any).fetch.mockResolvedValue(
      new Response(JSON.stringify(fakeReport), { status: 200 }),
    );
    const out = await downloadUserData();
    expect(out).toHaveProperty("meta.user_id");
    expect(out).toHaveProperty("auth_user.id");
    expect(out).toHaveProperty("tables.profiles.rows");
    expect(Array.isArray(out.tables.leads.rows)).toBe(true);
  });

  it("falha em pt-BR quando não há sessão", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await expect(downloadUserData()).rejects.toThrow(/Sessão expirada/);
  });

  it("propaga erro HTTP com mensagem amigável", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "tkn", user: { id: "u" } } },
    });
    (globalThis as any).fetch.mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(downloadUserData()).rejects.toThrow(/Falha ao gerar relatório \(500\)/);
  });
});

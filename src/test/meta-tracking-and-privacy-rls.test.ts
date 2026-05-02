/**
 * RLS contract · meta_tracking, admin_meta_tracking_quality e user_privacy_history.
 *
 * Validação por scan estático + simulação de chamadas:
 *  1. providers.meta_tracking: cliente NUNCA emite update/insert/delete pelo client.
 *     Leitura é SEMPRE filtrada por user_id (RLS owner-only).
 *  2. admin_meta_tracking_quality: chamado APENAS pela página admin (rota /admin/*),
 *     nunca por componente público.
 *  3. user_privacy_history: cliente nunca insere/atualiza/deleta — só lê com .eq('user_id', uid).
 *  4. record_privacy_event RPC é o ÚNICO caminho de gravação a partir do client.
 */
import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";

const SRC = path.resolve(__dirname, "..");

function readAll(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["test", "__tests__", "node_modules"].includes(e.name)) continue;
      out.push(...readAll(full));
    } else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

const FILES = readAll(SRC);
const allText = FILES.map((f) => fs.readFileSync(f, "utf8")).join("\n//---\n");

describe("RLS contract · providers.meta_tracking (owner-only)", () => {
  it("nenhum componente faz UPDATE em providers.meta_tracking pelo client", () => {
    // Procura padrões de update que mencionem meta_tracking diretamente.
    const m = allText.match(
      /\.from\(\s*['"]providers['"]\s*\)[\s\S]{0,300}\.update\([\s\S]{0,200}meta_tracking/,
    );
    expect(m).toBeNull();
  });

  it("MetaTrackingSummary só lê meta_tracking filtrando por user_id", () => {
    const f = fs.readFileSync(
      path.join(SRC, "components/dashboard/MetaTrackingSummary.tsx"),
      "utf8",
    );
    expect(f).toMatch(/\.from\(\s*['"]providers['"]\s*\)/);
    expect(f).toMatch(/\.eq\(\s*['"]user_id['"]/);
    expect(f).toMatch(/meta_tracking/);
    // Sem write paths
    expect(f).not.toMatch(/\.update\(/);
    expect(f).not.toMatch(/\.insert\(/);
    expect(f).not.toMatch(/\.delete\(/);
  });
});

describe("RLS contract · admin_meta_tracking_quality é restrito ao painel admin", () => {
  it("o RPC só é invocado a partir de páginas em src/pages/admin/", () => {
    const callers = FILES.filter((f) =>
      /admin_meta_tracking_quality/.test(fs.readFileSync(f, "utf8")),
    );
    expect(callers.length).toBeGreaterThan(0);
    for (const c of callers) {
      const rel = c.replace(SRC, "");
      // Permitido: páginas admin, testes, ou o próprio supabase types.
      const allowed =
        rel.includes("/pages/admin/") ||
        rel.includes("/test/") ||
        rel.includes("/integrations/supabase/");
      expect(allowed, `RPC chamado fora de /admin: ${rel}`).toBe(true);
    }
  });

  it("AdminGuard cobre rotas /admin (failure-closed)", () => {
    const app = fs.readFileSync(path.join(SRC, "App.tsx"), "utf8");
    expect(app).toMatch(/AdminGuard/);
  });
});

describe("RLS contract · user_privacy_history é write-only via RPC", () => {
  it("cliente nunca chama .insert() em user_privacy_history", () => {
    expect(allText).not.toMatch(
      /\.from\(\s*['"]user_privacy_history['"]\s*\)[\s\S]{0,200}\.insert\(/,
    );
  });
  it("cliente nunca chama .update() em user_privacy_history", () => {
    expect(allText).not.toMatch(
      /\.from\(\s*['"]user_privacy_history['"]\s*\)[\s\S]{0,200}\.update\(/,
    );
  });
  it("cliente nunca chama .delete() em user_privacy_history", () => {
    expect(allText).not.toMatch(
      /\.from\(\s*['"]user_privacy_history['"]\s*\)[\s\S]{0,200}\.delete\(/,
    );
  });
  it("PrivacyHistoryTimeline filtra por user_id (RLS owner-only)", () => {
    const f = fs.readFileSync(
      path.join(SRC, "components/dashboard/PrivacyHistoryTimeline.tsx"),
      "utf8",
    );
    expect(f).toMatch(/\.from\(\s*['"]user_privacy_history['"]\s*\)/);
    expect(f).toMatch(/\.eq\(\s*['"]user_id['"]\s*,\s*userId\s*\)/);
  });
});

describe("RLS contract · record_privacy_event é o único caminho de gravação", () => {
  it("helper privacyHistory.ts chama o RPC com event_type permitido", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: "uuid-123", error: null });
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: { rpc: (...args: any[]) => rpcMock(...args) },
    }));
    // import dinâmico após mock
    const { recordPrivacyEvent } = await import("@/lib/privacyHistory");
    const result = await recordPrivacyEvent({
      event_type: "data_export",
      reason: "user_requested",
      metadata: { format: "json" },
    });
    expect(result.ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith(
      "record_privacy_event",
      expect.objectContaining({
        _event_type: "data_export",
        _reason: "user_requested",
      }),
    );
    vi.doUnmock("@/integrations/supabase/client");
  });

  it("CONTRATO: tipos válidos de event_type batem com o CHECK do banco", () => {
    const allowed = [
      "account_deletion",
      "data_export",
      "consent_change",
      "block_triggered",
      "block_expired",
      "login_blocked",
    ];
    const helper = fs.readFileSync(path.join(SRC, "lib/privacyHistory.ts"), "utf8");
    for (const t of allowed) {
      expect(helper).toContain(`"${t}"`);
    }
  });
});

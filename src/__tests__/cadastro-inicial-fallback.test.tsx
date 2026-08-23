/**
 * Teste RTL · Fallback visível em /cadastro-inicial quando o self-heal falha.
 *
 * Cenário: usuário autenticado, mas o perfil não foi criado (insert falha
 * ou retries do refetchProfile esgotam). A página deve renderizar um card
 * de erro com botão "Tentar novamente" — NUNCA tela em branco.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "@/lib/router-compat";

// ── Mocks ───────────────────────────────────────────────────────────────
const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const insertSpy = vi.fn();
const maybeSingleSpy = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: maybeSingleSpy }),
      }),
      insert: insertSpy,
    }),
  },
}));

vi.mock("@/components/onboarding/wizard/phases/v2/telemetry", () => ({
  trackOnboardingEvent: vi.fn().mockResolvedValue(undefined),
}));

// Stub do WizardShell para isolarmos o teste no fallback da página.
vi.mock("@/components/onboarding/wizard/WizardShell", () => ({
  default: () => <div data-testid="wizard-shell">WIZARD_OK</div>,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
    success: vi.fn(),
  },
}));

import CadastroInicialPage from "@/pages/CadastroInicialPage";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/cadastro-inicial"]}>
      <CadastroInicialPage />
    </MemoryRouter>,
  );
}

describe("/cadastro-inicial · fallback de erro", () => {
  beforeEach(() => {
    insertSpy.mockReset();
    maybeSingleSpy.mockReset();
    mockUseAuth.mockReset();
    try { window.sessionStorage.clear(); } catch { /* noop */ }
  });

  it("perfil ausente + INSERT falha → exibe card de erro com botão Tentar novamente (sem tela branca)", async () => {
    maybeSingleSpy.mockResolvedValue({ data: null, error: null, status: 200 });
    insertSpy.mockResolvedValue({ error: { message: "duplicate key" } });
    mockUseAuth.mockReturnValue({
      user: { id: "u-1", user_metadata: {} },
      profile: null,
      loading: false,
      refetchProfile: vi.fn().mockResolvedValue(null),
    });

    renderPage();

    const retryBtn = await screen.findByTestId(
      "cadastro-retry-button",
      {},
      { timeout: 4000 },
    );
    expect(retryBtn).toBeInTheDocument();
    expect(
      screen.getByText(/Não conseguimos preparar seu cadastro/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-shell")).not.toBeInTheDocument();
  });

  it("loop guard ativo (retry session flag) + profile null → exibe fallback imediatamente", async () => {
    try {
      window.sessionStorage.setItem("cadastro_self_heal_attempted", "1");
    } catch { /* noop */ }

    mockUseAuth.mockReturnValue({
      user: { id: "u-2", user_metadata: {} },
      profile: null,
      loading: false,
      refetchProfile: vi.fn(),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("cadastro-retry-button")).toBeInTheDocument();
    });
    // Não deve ter consultado o banco neste caminho.
    expect(maybeSingleSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("perfil presente → renderiza WizardShell, não o fallback", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u-3" },
      profile: { id: "u-3", full_name: "Henrique" },
      loading: false,
      refetchProfile: vi.fn(),
    });

    renderPage();

    expect(await screen.findByTestId("wizard-shell")).toBeInTheDocument();
    expect(screen.queryByTestId("cadastro-retry-button")).not.toBeInTheDocument();
  });

  it("clique em 'Tentar novamente' limpa flag e força reload", async () => {
    try {
      window.sessionStorage.setItem("cadastro_self_heal_attempted", "1");
    } catch { /* noop */ }

    mockUseAuth.mockReturnValue({
      user: { id: "u-4" },
      profile: null,
      loading: false,
      refetchProfile: vi.fn(),
    });

    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });

    renderPage();

    const retryBtn = await screen.findByTestId("cadastro-retry-button");
    fireEvent.click(retryBtn);

    expect(window.sessionStorage.getItem("cadastro_self_heal_attempted")).toBeNull();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});

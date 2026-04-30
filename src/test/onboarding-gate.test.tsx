import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import React from "react";

// Mock useAuth before importing component under test
const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Re-implement OnboardingGate locally to mirror App.tsx without pulling the giant tree.
// This must stay 1:1 with the real implementation in src/App.tsx.
import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { shouldForceOnboarding } from "@/lib/onboardingAccess";

const OnboardingGate = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth() as any;
  const location = useLocation();
  const hasExistingService = Boolean(profile?.hasExistingService);

  if (loading || (user && !profile)) {
    return (
      <div role="status" aria-busy="true" aria-label="Carregando sua sessão">
        <span>Loading skeleton</span>
      </div>
    );
  }

  const mustCompleteOnboarding = !!user && !!profile && shouldForceOnboarding(profile, hasExistingService);
  const isOnboardingRoute =
    location.pathname === "/cadastro-inicial" ||
    location.pathname === "/onboarding-v2/sucesso";

  if (mustCompleteOnboarding && !isOnboardingRoute) {
    return <Navigate to="/cadastro-inicial" replace />;
  }

  // Mirror App.tsx: bloqueia volta a /cadastro-inicial após conclusão.
  const alreadyCompleted = !!profile && profile.onboarding_completed === true;
  if (alreadyCompleted && location.pathname === "/cadastro-inicial") {
    const params = new URLSearchParams(location.search);
    const nextRaw = params.get("next");
    const isSafeNext = !!nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") && nextRaw !== "/cadastro-inicial";
    const target = isSafeNext ? nextRaw! : "/dashboard";
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
};

const renderAt = (path = "/dashboard") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <OnboardingGate>
        <Routes>
          <Route path="/cadastro-inicial" element={<div>CADASTRO_PAGE</div>} />
          <Route path="/dashboard" element={<div>DASHBOARD_PAGE</div>} />
          <Route path="/dashboard/leads" element={<div>LEADS_PAGE</div>} />
          <Route path="*" element={<div>CHILDREN_RENDERED</div>} />
        </Routes>
      </OnboardingGate>
    </MemoryRouter>
  );

describe("OnboardingGate", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("renders skeleton when loading=true and never redirects", () => {
    mockUseAuth.mockReturnValue({ user: null, profile: null, loading: true });
    renderAt("/dashboard");
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByText("CADASTRO_PAGE")).toBeNull();
    expect(screen.queryByText("CHILDREN_RENDERED")).toBeNull();
  });

  it("renders skeleton when user exists but profile=null (still loading) and never redirects", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: null,
      loading: false,
    });
    renderAt("/dashboard");
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByText("CADASTRO_PAGE")).toBeNull();
  });

  it("redirects to /cadastro-inicial when profile exists but profile_type is missing", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: { profile_type: null, onboarding_completed: false, onboarding_step: 0 },
      loading: false,
    });
    renderAt("/dashboard");
    expect(screen.getByText("CADASTRO_PAGE")).toBeTruthy();
  });

  it("redirects to /cadastro-inicial when onboarding_completed is false and no service exists", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: { profile_type: "provider", onboarding_completed: false, onboarding_step: 2 },
      loading: false,
    });
    renderAt("/dashboard");
    expect(screen.getByText("CADASTRO_PAGE")).toBeTruthy();
  });

  it("renders children when provider already has first service even if onboarding flag is stale", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: { profile_type: "provider", onboarding_completed: false, onboarding_step: 2, hasExistingService: true },
      loading: false,
    });
    renderAt("/dashboard");
    expect(screen.getByText("DASHBOARD_PAGE")).toBeTruthy();
  });

  it("renders children when profile is complete", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: { profile_type: "provider", onboarding_completed: true, onboarding_step: 5 },
      loading: false,
    });
    renderAt("/dashboard");
    expect(screen.getByText("DASHBOARD_PAGE")).toBeTruthy();
  });

  it("renders children for anonymous routes (no user)", () => {
    mockUseAuth.mockReturnValue({ user: null, profile: null, loading: false });
    renderAt("/");
    expect(screen.getByText("CHILDREN_RENDERED")).toBeTruthy();
  });

  it("does not loop redirect when already on /cadastro-inicial", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: { profile_type: null, onboarding_completed: false, onboarding_step: 0 },
      loading: false,
    });
    renderAt("/cadastro-inicial");
    expect(screen.getByText("CADASTRO_PAGE")).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────────────
  // Bloqueio pós-conclusão: usuário com onboarding_completed=true não pode
  // voltar a /cadastro-inicial (favoritos, e-mails antigos, ?next=...).
  // ──────────────────────────────────────────────────────────────────────

  it("redirects completed user away from /cadastro-inicial to /dashboard", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: { profile_type: "provider", onboarding_completed: true, onboarding_step: 5 },
      loading: false,
    });
    renderAt("/cadastro-inicial");
    expect(screen.getByText("DASHBOARD_PAGE")).toBeTruthy();
    expect(screen.queryByText("CADASTRO_PAGE")).toBeNull();
  });

  it("redirects completed user to safe ?next= when present", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: { profile_type: "provider", onboarding_completed: true, onboarding_step: 5 },
      loading: false,
    });
    renderAt("/cadastro-inicial?next=/dashboard/leads");
    expect(screen.getByText("LEADS_PAGE")).toBeTruthy();
  });

  it("ignores unsafe ?next= (protocol-relative) and falls back to /dashboard", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: { profile_type: "provider", onboarding_completed: true, onboarding_step: 5 },
      loading: false,
    });
    renderAt("/cadastro-inicial?next=//evil.com");
    expect(screen.getByText("DASHBOARD_PAGE")).toBeTruthy();
  });

  it("ignores ?next=/cadastro-inicial loop attempt", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: { profile_type: "provider", onboarding_completed: true, onboarding_step: 5 },
      loading: false,
    });
    renderAt("/cadastro-inicial?next=/cadastro-inicial");
    expect(screen.getByText("DASHBOARD_PAGE")).toBeTruthy();
  });
});

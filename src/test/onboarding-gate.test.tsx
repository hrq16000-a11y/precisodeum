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

const OnboardingGate = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth() as any;
  const location = useLocation();

  if (loading || (user && !profile)) {
    return (
      <div role="status" aria-busy="true" aria-label="Carregando sua sessão">
        <span>Loading skeleton</span>
      </div>
    );
  }

  const onboardingStep = Number(profile?.onboarding_step ?? 0);
  const mustCompleteOnboarding = !!user && !!profile && (
    !profile.profile_type ||
    profile.onboarding_completed !== true ||
    onboardingStep < 5
  );

  if (mustCompleteOnboarding && location.pathname !== "/triagem") {
    return <Navigate to="/triagem" replace />;
  }

  return <>{children}</>;
};

const renderAt = (path = "/dashboard") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/triagem" element={<div>TRIAGEM_PAGE</div>} />
        <Route
          path="*"
          element={
            <OnboardingGate>
              <div>CHILDREN_RENDERED</div>
            </OnboardingGate>
          }
        />
      </Routes>
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
    expect(screen.queryByText("TRIAGEM_PAGE")).toBeNull();
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
    expect(screen.queryByText("TRIAGEM_PAGE")).toBeNull();
  });

  it("redirects to /triagem when profile exists but profile_type is missing", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: { profile_type: null, onboarding_completed: false, onboarding_step: 0 },
      loading: false,
    });
    renderAt("/dashboard");
    expect(screen.getByText("TRIAGEM_PAGE")).toBeTruthy();
  });

  it("redirects to /triagem when onboarding_completed is false", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: { profile_type: "provider", onboarding_completed: false, onboarding_step: 2 },
      loading: false,
    });
    renderAt("/dashboard");
    expect(screen.getByText("TRIAGEM_PAGE")).toBeTruthy();
  });

  it("renders children when profile is complete", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: { profile_type: "provider", onboarding_completed: true, onboarding_step: 5 },
      loading: false,
    });
    renderAt("/dashboard");
    expect(screen.getByText("CHILDREN_RENDERED")).toBeTruthy();
  });

  it("renders children for anonymous routes (no user)", () => {
    mockUseAuth.mockReturnValue({ user: null, profile: null, loading: false });
    renderAt("/");
    expect(screen.getByText("CHILDREN_RENDERED")).toBeTruthy();
    expect(screen.queryByText("TRIAGEM_PAGE")).toBeNull();
  });

  it("does not loop redirect when already on /triagem", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: { profile_type: null, onboarding_completed: false, onboarding_step: 0 },
      loading: false,
    });
    renderAt("/triagem");
    expect(screen.getByText("TRIAGEM_PAGE")).toBeTruthy();
  });
});

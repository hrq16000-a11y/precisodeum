import { lazy as reactLazy, Suspense, useEffect, useState } from "react";
import RouteMotion from "./components/motion/RouteMotion";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Navigate, useLocation } from "react-router-dom";
const Sonner = reactLazy(() => importWithRetry(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster }))));
// FIX 6 (Onda 4): Radix `<Toaster />` removido — `@/hooks/use-toast` agora encaminha a Sonner.
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AdDebugProvider } from "@/contexts/AdDebugContext";
import { WhatsAppGateProvider, WhatsAppGateInterceptor } from "@/contexts/WhatsAppGateContext";
import { importWithRetry, prefetchImportWithRetry } from "@/lib/lazyWithRetry";
import ScrollToTop from "./components/ScrollToTop";
import ErrorGuard from "./components/ErrorGuard";
import LazyRouteBoundary from "./components/LazyRouteBoundary";
const MobileBottomNav = reactLazy(() => importWithRetry(() => import("./components/MobileBottomNav")));
const BackToTopButton = reactLazy(() => importWithRetry(() => import("./components/BackToTopButton")));
const ScrollProgressBar = reactLazy(() => importWithRetry(() => import("./components/ui/ScrollProgressBar")));
const ImpersonationBanner = reactLazy(() => importWithRetry(() => import("./components/admin/ImpersonationBanner")));
const GlobalExitIntentDialog = reactLazy(() => importWithRetry(() => import("./components/GlobalExitIntentDialog")));
import { useAuth } from "@/hooks/useAuth";
import { initializeUiFreezeMonitor } from "@/lib/uiFreezeMonitor";
import { installPopupGuards } from "@/lib/popupGuards";
import { appendWizardResetDebugLog } from "@/lib/wizardResetDebug";
import { isOnboardingCompletionGraceActive, resolveOnboardingGateTarget } from "@/lib/onboardingAccess";
import { runOnboardingSelfHeal } from "@/lib/onboardingSelfHeal";
import PWAUpdatePrompt from "./components/PWAUpdatePrompt";
import { queryClient } from '@/lib/queryClient';
import { pausePrefetching, cancelPendingPrefetches } from "@/lib/lazyWithRetry";
import WebVitalsOverlay from "@/components/WebVitalsOverlay";
import { markNavigationStart, markNavigationEnd, startWebVitalsMonitor } from "@/lib/webVitalsMonitor";

// Route groups — extraídos para src/routes/* (PR 3 · split estrutural).
// App.tsx é apenas composição: providers + shells + Suspense + gates.
import { publicRoutes, PUBLIC_PATH_PREFIXES } from "@/routes/publicRoutes";
import { dashboardRoutes } from "@/routes/dashboardRoutes";
import { adminRoutes } from "@/routes/adminRoutes";
import { sponsorRoutes } from "@/routes/sponsorRoutes";

const CookieConsent = reactLazy(() => importWithRetry(() => import("./components/CookieConsent")));
const PwaInstallBanner = reactLazy(() => importWithRetry(() => import("./components/PwaInstallBanner")));
const AppVersionGate = reactLazy(() => importWithRetry(() => import("./components/AppVersionGate")));
const OAuthRedirectHandler = reactLazy(() => importWithRetry(() => import("./components/OAuthRedirectHandler")));
const FloatingHelpButton = reactLazy(() => importWithRetry(() => import("./components/FloatingHelpButton")));

// Minimal page transition — no heavy loader, pages render instantly
const CurtainReveal = reactLazy(() => importWithRetry(() => import("./components/CurtainReveal")));
const GlobalLinkPrefetcher = reactLazy(() => importWithRetry(() => import("./components/GlobalLinkPrefetcher")));
const RouteSkeleton = reactLazy(() => importWithRetry(() => import("./components/motion/RouteSkeleton")));

/** Fallback de rota: barra de progresso + skeleton atrasado (sem flash). */
const PageFallback = () => (
  <Suspense
    fallback={
      <div
        role="status"
        aria-live="polite"
        aria-label="Carregando página"
        className="fixed left-0 right-0 top-0 z-[9999] h-0.5 overflow-hidden bg-transparent"
      >
        <div className="h-full w-1/3 animate-[routeProgress_1.1s_ease-in-out_infinite] bg-primary/70" />
        <style>{`@keyframes routeProgress{0%{transform:translateX(-100%)}60%{transform:translateX(180%)}100%{transform:translateX(320%)}}`}</style>
      </div>
    }
  >
    <RouteSkeleton />
  </Suspense>
);

const hasRequestIdleCallback = () => typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function';
const hasCancelIdleCallback = () => typeof window !== 'undefined' && typeof (window as any).cancelIdleCallback === 'function';

/** Deferred UI shell — renders floating components only after initial paint to reduce TTI */
const DeferredShell = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = hasRequestIdleCallback()
      ? (window as any).requestIdleCallback(() => setReady(true), { timeout: 800 })
      : window.setTimeout(() => setReady(true), 250);
    return () => {
      if (hasCancelIdleCallback()) (window as any).cancelIdleCallback(id as number);
      else clearTimeout(id as number);
    };
  }, []);
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <CurtainReveal />
      <Sonner />
      <AppVersionGate />
      <ScrollProgressBar />
      <MobileBottomNav />
      <FloatingHelpButton />
      <BackToTopButton />
      <CookieConsent />
      <PwaInstallBanner />
      <GlobalLinkPrefetcher />
      <AnalyticsLoader />
      <WebVitalsOverlay />


    </Suspense>
  );
};

const RoutePrefetcher = () => {
  const location = useLocation();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Marca início da navegação (para métricas) e pausa a fila de prefetch por
    // ~700ms para não competir com o download do chunk da rota atual.
    markNavigationStart(location.pathname);
    pausePrefetching(700);
    cancelPendingPrefetches();

    const rafId = requestAnimationFrame(() => markNavigationEnd(location.pathname));

    const prefetch = () => {
      if (location.pathname === '/' || location.pathname === '/index') {
        void prefetchImportWithRetry('route-search', () => import('./pages/SearchPage'));
        void prefetchImportWithRetry('route-category', () => import('./pages/CategoryPage'));
        return;
      }
      if (location.pathname.startsWith('/buscar') || location.pathname.startsWith('/categoria/')) {
        void prefetchImportWithRetry('route-provider', () => import('./pages/ProviderProfile'));
      }
    };
    const id = 'requestIdleCallback' in window
      ? (window as any).requestIdleCallback(prefetch, { timeout: 3500 })
      : globalThis.setTimeout(prefetch, 2200);
    return () => {
      cancelAnimationFrame(rafId);
      if ('cancelIdleCallback' in window) (window as any).cancelIdleCallback(id);
      else globalThis.clearTimeout(id);
    };
  }, [location.pathname]);
  return null;
};

const isPublicPath = (pathname: string) => {
  if (pathname === '/' || pathname === '/index') return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
};

const OnboardingGate = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, provider, loading, refetchProfile } = useAuth();
  const location = useLocation();
  const isWizardTestRoute = location.pathname === '/__test/report-button';
  const publicRoute = isPublicPath(location.pathname);


  // Self-heal idempotente para perfis legados (provider + 1º serviço já criados
  // mas com `onboarding_completed=false`). Roda no MÁXIMO uma vez por user.id
  // por aba e é totalmente desacoplada do render — o Gate em si permanece
  // 100% read-only e determinístico.
  useEffect(() => {
    if (loading) return;
    if (!user || !profile) return;
    if (profile.profile_type !== 'provider') return;
    if (profile.onboarding_completed === true) return;
    // Guard: nunca rodar self-heal enquanto o usuário está dentro do Wizard.
    // O WizardShell adquire o wizardSessionLock no mount, mas há uma janela
    // entre o Gate montar e o Shell montar onde o self-heal poderia escrever
    // onboarding_completed=true e ejetar o usuário para o /dashboard.
    if (location.pathname === '/cadastro-inicial') return;

    let cancelled = false;
    void runOnboardingSelfHeal({ userId: user.id, profile, provider })
      .then((healed) => {
        if (!cancelled && healed) void refetchProfile();
      })
      .catch((err) => {
        console.error('[selfHeal] unhandled:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user, profile, provider, refetchProfile, location.pathname]);

  // [V8 PERF] Rotas públicas renderizam IMEDIATAMENTE — sem esperar auth.
  // ProtectedRoute é responsável pelo spinner/redirect em rotas privadas.
  if (publicRoute || isWizardTestRoute) {
    return <>{children}</>;
  }

  // While auth is resolving, or user exists but profile not yet loaded,
  // render an accessible skeleton instead of null to avoid blank screens.
  if (loading || (user && !profile)) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Carregando sua sessão"
        className="flex min-h-screen items-center justify-center bg-background"
      >
        <div className="w-full max-w-md space-y-3 px-4">
          <div className="h-8 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        </div>
        <span className="sr-only">Carregando…</span>
      </div>
    );
  }

  const onboardingStep = Number(profile?.onboarding_step ?? 0);
  // GATE GUARD (regression-locked): bloqueia o dashboard enquanto
  // `onboarding_completed !== true` — a lógica vive em `resolveOnboardingGateTarget`,
  // este comentário fica aqui para que o teste de regressão de onboarding
  // (`onboarding-regression.test.ts`) possa travar o critério via grep.
  const gateDecision = resolveOnboardingGateTarget({
    profile,
    // hasExistingService = false: a recuperação para perfis legados é
    // tratada de forma assíncrona por `runOnboardingSelfHeal` no efeito
    // acima — quando ele completa, o `refetchProfile` traz a flag atualizada
    // e este gate reavalia. Isso mantém o Gate 100% determinístico.
    hasExistingService: false,
    completionGraceActive: isOnboardingCompletionGraceActive(),
    pathname: location.pathname,
    search: location.search,
  });

  if (!isWizardTestRoute && gateDecision.action === 'redirect' && gateDecision.reason === 'global-onboarding-gate') {
    appendWizardResetDebugLog({
      source: 'onboarding-gate-redirect',
      route: `${location.pathname}${location.search}`,
      nextRoute: gateDecision.target,
      phase: null,
      reason: gateDecision.reason,
      meta: {
        profile_type: profile?.profile_type ?? null,
        onboarding_completed: profile?.onboarding_completed ?? null,
        onboarding_step: onboardingStep,
      },
    });
    return <Navigate to={gateDecision.target} replace />;
  }

  if (gateDecision.action === 'redirect' && gateDecision.reason === 'already-completed-blocking-cadastro-inicial') {
    appendWizardResetDebugLog({
      source: 'onboarding-gate-block-completed',
      route: `${location.pathname}${location.search}`,
      nextRoute: gateDecision.target,
      phase: null,
      reason: gateDecision.reason,
      meta: {
        profile_type: profile?.profile_type ?? null,
        onboarding_completed: profile?.onboarding_completed ?? null,
        had_next_param: new URLSearchParams(location.search).has('next'),
      },
    });
    return <Navigate to={gateDecision.target} replace />;
  }


  return <>{children}</>;
};

const App = () => {
  useEffect(() => {
    initializeUiFreezeMonitor();
    installPopupGuards();
    startWebVitalsMonitor();

    // Invalidate all queries if daily purge just ran
    if ((window as any).__DAILY_PURGE_TRIGGERED__) {
      delete (window as any).__DAILY_PURGE_TRIGGERED__;
      queryClient.invalidateQueries();
      if (import.meta.env.DEV) {
        console.debug('[Cache] React Query invalidated (daily purge).');
      }
    }

    return undefined;
  }, []);

  return (
    <ErrorGuard componentName="App">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PWAUpdatePrompt />
        <BrowserRouter>
          <RoutePrefetcher />
          <ScrollToTop />
            <AuthProvider>
            {/* PR-A2: AdDebugProvider só monta em DEV. Em produção os consumidores
                recebem os defaults seguros do createContext (xrayEnabled=false, noops),
                eliminando a árvore de re-render e ~1170ms de bootstrap em produção. */}
            {import.meta.env.DEV ? (
              <AdDebugProvider>
                <WhatsAppGateProvider>
                <WhatsAppGateInterceptor />
                <Suspense fallback={null}><OAuthRedirectHandler /></Suspense>
                <Suspense fallback={null}><ImpersonationBanner /></Suspense>
                <Suspense fallback={null}><GlobalExitIntentDialog /></Suspense>
                <Suspense fallback={<PageFallback />}>
                  <LazyRouteBoundary>
                  <OnboardingGate>
                    <RouteMotion>
                    <Routes>
                      {publicRoutes}
                      {dashboardRoutes}
                      {adminRoutes}
                      {sponsorRoutes}
                    </Routes>
                    </RouteMotion>
                  </OnboardingGate>
                  </LazyRouteBoundary>
                </Suspense>
                <DeferredShell />
                </WhatsAppGateProvider>
              </AdDebugProvider>
            ) : (
              <WhatsAppGateProvider>
              <WhatsAppGateInterceptor />
              <Suspense fallback={null}><OAuthRedirectHandler /></Suspense>
              <Suspense fallback={null}><ImpersonationBanner /></Suspense>
              <Suspense fallback={null}><GlobalExitIntentDialog /></Suspense>
              <Suspense fallback={<PageFallback />}>
                <LazyRouteBoundary>
                <OnboardingGate>
                  <RouteMotion>
                  <Routes>
                    {publicRoutes}
                    {dashboardRoutes}
                    {adminRoutes}
                    {sponsorRoutes}
                  </Routes>
                  </RouteMotion>
                </OnboardingGate>
                </LazyRouteBoundary>
              </Suspense>
              <DeferredShell />
              </WhatsAppGateProvider>
            )}
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorGuard>
  );
};

export default App;

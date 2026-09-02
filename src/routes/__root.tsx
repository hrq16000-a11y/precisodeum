/// <reference types="vite/client" />
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  Outlet,
  useRouter,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  Fragment,
  lazy as reactLazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { HelmetProvider } from "react-helmet-async";
import appCss from "../styles.css?url";

import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorGuard from "@/components/ErrorGuard";
import LazyRouteBoundary from "@/components/LazyRouteBoundary";
import ScrollToTop from "@/components/ScrollToTop";
import RouteMotion from "@/components/motion/RouteMotion";
import PWAUpdatePrompt from "@/components/PWAUpdatePrompt";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AdDebugProvider } from "@/contexts/AdDebugContext";
import { WhatsAppGateProvider, WhatsAppGateInterceptor } from "@/contexts/WhatsAppGateContext";
import { queryClient } from "@/lib/queryClient";
import { importWithRetry, prefetchImportWithRetry, pausePrefetching, cancelPendingPrefetches } from "@/lib/lazyWithRetry";
import { initializeUiFreezeMonitor } from "@/lib/uiFreezeMonitor";
import { installPopupGuards } from "@/lib/popupGuards";
import { appendWizardResetDebugLog } from "@/lib/wizardResetDebug";
import { isOnboardingCompletionGraceActive, resolveOnboardingGateTarget } from "@/lib/onboardingAccess";
import { runOnboardingSelfHeal } from "@/lib/onboardingSelfHeal";
import { markNavigationStart, markNavigationEnd, startWebVitalsMonitor } from "@/lib/webVitalsMonitor";
import { installClientBootstrap } from "@/lib/clientBootstrap";
import { isPublicPath } from "@/lib/publicPaths";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { useLocation, Navigate } from "@/lib/router-compat";
import WebVitalsOverlay from "@/components/WebVitalsOverlay";

// ---------- lazy shell components (portados de App.tsx) ----------
const Sonner = reactLazy(() => importWithRetry(() => import("@/components/ui/sonner").then((m) => ({ default: m.Toaster }))));
const MobileBottomNav = reactLazy(() => importWithRetry(() => import("@/components/MobileBottomNav")));
const BackToTopButton = reactLazy(() => importWithRetry(() => import("@/components/BackToTopButton")));
const ScrollProgressBar = reactLazy(() => importWithRetry(() => import("@/components/ui/ScrollProgressBar")));
const ImpersonationBanner = reactLazy(() => importWithRetry(() => import("@/components/admin/ImpersonationBanner")));
const GlobalExitIntentDialog = reactLazy(() => importWithRetry(() => import("@/components/GlobalExitIntentDialog")));
const CookieConsent = reactLazy(() => importWithRetry(() => import("@/components/CookieConsent")));
const PwaInstallBanner = reactLazy(() => importWithRetry(() => import("@/components/PwaInstallBanner")));
const AppVersionGate = reactLazy(() => importWithRetry(() => import("@/components/AppVersionGate")));
const OAuthRedirectHandler = reactLazy(() => importWithRetry(() => import("@/components/OAuthRedirectHandler")));
const FloatingHelpButton = reactLazy(() => importWithRetry(() => import("@/components/FloatingHelpButton")));
const CurtainReveal = reactLazy(() => importWithRetry(() => import("@/components/CurtainReveal")));
const GlobalLinkPrefetcher = reactLazy(() => importWithRetry(() => import("@/components/GlobalLinkPrefetcher")));
const AnalyticsLoader = reactLazy(() => importWithRetry(() => import("@/components/AnalyticsLoader")));
const RouteSkeleton = reactLazy(() => importWithRetry(() => import("@/components/motion/RouteSkeleton")));
const NotFoundPage = reactLazy(() => importWithRetry(() => import("@/pages/NotFound")));

const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://precisodeum.com.br/#website",
      url: "https://precisodeum.com.br",
      name: "Preciso de um",
      description: "Marketplace de serviços profissionais. Encontre eletricistas, encanadores, técnicos e muito mais na sua cidade.",
      inLanguage: "pt-BR",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://precisodeum.com.br/buscar?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": "https://precisodeum.com.br/#organization",
      name: "Preciso de um",
      url: "https://precisodeum.com.br",
      logo: "https://precisodeum.com.br/lovable-uploads/logo-pdup-v3.png",
      description: "Plataforma brasileira que conecta pessoas a profissionais confiáveis em diversas áreas de serviço.",
      sameAs: [],
    },
  ],
});

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0, viewport-fit=cover" },
      { title: "Preciso de um — Profissionais qualificados no Brasil" },
      { name: "description", content: "Marketplace de serviços profissionais. Encontre eletricistas, encanadores, técnicos e muito mais na sua cidade." },
      { name: "author", content: "Preciso de um" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { name: "ai-content-declaration", content: "human-created" },
      { name: "google-site-verification", content: "h97RiP9kvBmvJMx51FYwexJD7rNX0CGmIGKsKN7Heqo" },
      { name: "google-adsense-account", content: "ca-pub-3762170279587706" },
      { name: "theme-color", content: "#F97316" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Preciso de Um" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: "Preciso de um" },
      { property: "og:url", content: "https://precisodeum.com.br" },
      { property: "og:title", content: "Preciso de um — Profissionais qualificados no Brasil" },
      { property: "og:description", content: "Marketplace de serviços profissionais. Encontre eletricistas, encanadores, técnicos e muito mais na sua cidade." },
      { property: "og:image", content: "https://precisodeum.com.br/social-image.png" },
      { property: "og:image:secure_url", content: "https://precisodeum.com.br/social-image.png" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Preciso de um Profissional - Marketplace de serviços do Brasil" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Preciso de um — Profissionais qualificados no Brasil" },
      { name: "twitter:description", content: "Marketplace de serviços profissionais. Encontre eletricistas, encanadores, técnicos e muito mais na sua cidade." },
      { name: "twitter:image", content: "https://precisodeum.com.br/social-image.png" },
      { name: "twitter:image:alt", content: "Preciso de um Profissional" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/icons/favicon-8fe41ba8ab.ico?v=8fe41ba8ab", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/icons/icon-16x16-8fe41ba8ab.png" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icons/icon-32x32-8fe41ba8ab.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192x192-8fe41ba8ab.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icons/icon-512x512-8fe41ba8ab.png" },
      { rel: "manifest", href: "/manifest.json?v=8fe41ba8ab" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon-180x180-8fe41ba8ab.png" },
      { rel: "apple-touch-icon", sizes: "152x152", href: "/icons/icon-152x152-8fe41ba8ab.png" },
      { rel: "apple-touch-icon", sizes: "120x120", href: "/icons/apple-touch-icon-120x120-8fe41ba8ab.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://ipapi.co" },
      { rel: "dns-prefetch", href: "https://api.open-meteo.com" },
      { rel: "dns-prefetch", href: "https://api.bigdatacloud.net" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Inter:wght@400;500&display=swap" },
    ],
    scripts: [
      // AdSense é injetado pós-hidratação em clientBootstrap.ts — o script no
      // head SSR insere <ins class="adsbygoogle-noablate"> antes do React
      // hidratar e causa hydration mismatch em todas as páginas.
      { type: "application/ld+json", children: JSON_LD },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <Suspense fallback={null}>
      <NotFoundPage />
    </Suspense>
  ),
  errorComponent: RootErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error("[__root errorComponent]", error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-foreground">
      <h1 className="text-2xl font-bold">Esta página não carregou</h1>
      <p className="max-w-md text-center text-muted-foreground">
        Algo deu errado ao carregar esta página. Tente novamente ou volte para a página inicial.
      </p>
      <div className="flex gap-3">
        <button
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
          onClick={() => {
            void router.invalidate();
            reset();
          }}
        >
          Tentar novamente
        </button>
        <a href="/" className="rounded-md border border-border px-4 py-2 font-medium">
          Ir para o início
        </a>
      </div>
    </div>
  );
}

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

const hasRequestIdleCallback = () => typeof window !== "undefined" && typeof (window as any).requestIdleCallback === "function";
const hasCancelIdleCallback = () => typeof window !== "undefined" && typeof (window as any).cancelIdleCallback === "function";

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
    if (typeof window === "undefined") return;
    markNavigationStart(location.pathname);
    pausePrefetching(700);
    cancelPendingPrefetches();

    const rafId = requestAnimationFrame(() => markNavigationEnd(location.pathname));

    const prefetch = () => {
      if (location.pathname === "/" || location.pathname === "/index") {
        void prefetchImportWithRetry("route-search", () => import("@/pages/SearchPage"));
        void prefetchImportWithRetry("route-category", () => import("@/pages/CategoryPage"));
        return;
      }
      if (location.pathname.startsWith("/buscar") || location.pathname.startsWith("/categoria/")) {
        void prefetchImportWithRetry("route-provider", () => import("@/pages/ProviderProfile"));
      }
    };
    const id = "requestIdleCallback" in window
      ? (window as any).requestIdleCallback(prefetch, { timeout: 3500 })
      : globalThis.setTimeout(prefetch, 2200);
    return () => {
      cancelAnimationFrame(rafId);
      if ("cancelIdleCallback" in window) (window as any).cancelIdleCallback(id);
      else globalThis.clearTimeout(id);
    };
  }, [location.pathname]);
  return null;
};

const OnboardingGate = ({ children }: { children: ReactNode }) => {
  const { user, profile, provider, loading, refetchProfile } = useAuth();
  const location = useLocation();
  const isWizardTestRoute = location.pathname === "/__test/report-button";
  const publicRoute = isPublicPath(location.pathname);

  // Hidratação determinística: o servidor nunca conhece a sessão, então rotas
  // privadas renderizam SEMPRE o skeleton no SSR e no primeiro render do
  // cliente. Sem isso o cliente podia resolver a sessão do storage antes da
  // hidratação e divergir da árvore SSR (hydration mismatch fatal).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Self-heal idempotente para perfis legados — read-only gate, efeito desacoplado.
  useEffect(() => {
    if (loading) return;
    if (!user || !profile) return;
    if (profile.profile_type !== "provider") return;
    if (profile.onboarding_completed === true) return;
    if (location.pathname === "/cadastro-inicial") return;

    let cancelled = false;
    void runOnboardingSelfHeal({ userId: user.id, profile, provider })
      .then((healed) => {
        if (!cancelled && healed) void refetchProfile();
      })
      .catch((err) => {
        console.error("[selfHeal] unhandled:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user, profile, provider, refetchProfile, location.pathname]);

  // Rotas públicas renderizam IMEDIATAMENTE — sem esperar auth.
  if (publicRoute || isWizardTestRoute) {
    return <>{children}</>;
  }

  if (!hydrated || loading || (user && !profile)) {
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
  // `onboarding_completed !== true` — a lógica vive em `resolveOnboardingGateTarget`.
  const gateDecision = resolveOnboardingGateTarget({
    profile,
    hasExistingService: false,
    completionGraceActive: isOnboardingCompletionGraceActive(),
    pathname: location.pathname,
    search: location.search,
  });

  if (!isWizardTestRoute && gateDecision.action === "redirect" && gateDecision.reason === "global-onboarding-gate") {
    appendWizardResetDebugLog({
      source: "onboarding-gate-redirect",
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

  if (gateDecision.action === "redirect" && gateDecision.reason === "already-completed-blocking-cadastro-inicial") {
    appendWizardResetDebugLog({
      source: "onboarding-gate-block-completed",
      route: `${location.pathname}${location.search}`,
      nextRoute: gateDecision.target,
      phase: null,
      reason: gateDecision.reason,
      meta: {
        profile_type: profile?.profile_type ?? null,
        onboarding_completed: profile?.onboarding_completed ?? null,
        had_next_param: new URLSearchParams(location.search).has("next"),
      },
    });
    return <Navigate to={gateDecision.target} replace />;
  }

  return <>{children}</>;
};

function RootComponent() {
  useEffect(() => {
    // ported from main.tsx — side-effects de bootstrap do cliente
    installClientBootstrap();
    initializeUiFreezeMonitor();
    installPopupGuards();
    startWebVitalsMonitor();

    if ((window as any).__DAILY_PURGE_TRIGGERED__) {
      delete (window as any).__DAILY_PURGE_TRIGGERED__;
      queryClient.invalidateQueries();
      if (import.meta.env.DEV) {
        console.debug("[Cache] React Query invalidated (daily purge).");
      }
    }
  }, []);

  // AdDebugProvider só monta em DEV — em produção os consumidores recebem
  // os defaults seguros do createContext (mesmo comportamento do App.tsx original).
  const DebugWrapper = import.meta.env.DEV ? AdDebugProvider : Fragment;

  return (
    <ErrorGuard componentName="App">
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <PWAUpdatePrompt />
            <RoutePrefetcher />
            <ScrollToTop />
            <AuthProvider>
              <DebugWrapper>
                <WhatsAppGateProvider>
                  <WhatsAppGateInterceptor />
                  <Suspense fallback={null}><OAuthRedirectHandler /></Suspense>
                  <Suspense fallback={null}><ImpersonationBanner /></Suspense>
                  <Suspense fallback={null}><GlobalExitIntentDialog /></Suspense>
                  <Suspense fallback={<PageFallback />}>
                    <LazyRouteBoundary>
                      <OnboardingGate>
                        <RouteMotion>
                          <Outlet />
                        </RouteMotion>
                      </OnboardingGate>
                    </LazyRouteBoundary>
                  </Suspense>
                  <DeferredShell />
                </WhatsAppGateProvider>
              </DebugWrapper>
            </AuthProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorGuard>
  );
}

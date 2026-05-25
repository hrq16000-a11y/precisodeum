import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Search, Briefcase, UserPlus, LifeBuoy, Home, FileQuestion } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.warn("404 Error: User attempted to access non-existent route:", location.pathname);

    // Telemetria fire-and-forget — captura referrer interno (link quebrado
    // dentro da própria plataforma) vs externo para priorizar correções.
    const path = location.pathname + location.search;
    const referrer = typeof document !== "undefined" ? document.referrer || null : null;
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : null;
    let referrerKind: "internal" | "external" | "direct" = "direct";
    if (referrer) {
      try {
        const refUrl = new URL(referrer);
        referrerKind =
          typeof window !== "undefined" && refUrl.host === window.location.host
            ? "internal"
            : "external";
      } catch {
        referrerKind = "external";
      }
    }
    (async () => {
      try {
        const composedUa = userAgent
          ? `${userAgent.slice(0, 240)} | kind:${referrerKind}`
          : `kind:${referrerKind}`;
        await supabase.rpc("log_error_page_event" as any, {
          _path: path,
          _code: 404,
          _referrer: referrer,
          _user_agent: composedUa,
        } as any);
      } catch (e) {
        console.debug("[NotFound] Failed to log event:", e);
      }
    })();
  }, [location.pathname, location.search]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="text-center max-w-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <FileQuestion className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-6xl font-bold text-primary">404</h1>
          <p className="mt-3 text-lg font-semibold text-foreground">Página não encontrada</p>
          <p className="mt-2 text-sm text-muted-foreground">
            A página que você procura não existe, foi movida ou está temporariamente indisponível.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link to="/buscar">
                <Search className="mr-1.5 h-4 w-4" /> Buscar Profissionais
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">
                <Home className="mr-1.5 h-4 w-4" /> Ir para Início
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/ajuda">
                <LifeBuoy className="mr-1.5 h-4 w-4" /> Falar com suporte
              </Link>
            </Button>
          </div>

          <div className="mt-8 rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-sm font-medium text-foreground">Atalhos úteis</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Link to="/categorias" className="rounded-full bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground border border-border">
                Categorias
              </Link>
              <Link to="/cidades" className="rounded-full bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground border border-border">
                Cidades
              </Link>
              <Link to="/vagas" className="rounded-full bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground border border-border">
                <Briefcase className="mr-1 inline h-3 w-3" /> Vagas
              </Link>
              <Link to="/cadastro" className="rounded-full bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground border border-border">
                <UserPlus className="mr-1 inline h-3 w-3" /> Cadastre-se
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NotFound;

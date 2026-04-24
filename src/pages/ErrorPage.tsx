import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Search, Briefcase, RefreshCcw, Home, AlertTriangle, FileQuestion } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { reportError } from "@/lib/errorReporter";

interface ErrorPageProps {
  code?: 404 | 500;
}

const COPY = {
  404: {
    title: "404",
    headline: "Página não encontrada",
    description: "A página que você procura não existe, foi movida ou está temporariamente indisponível.",
    Icon: FileQuestion,
  },
  500: {
    title: "500",
    headline: "Ops! Algo deu errado por aqui",
    description: "Tivemos uma instabilidade ao carregar esta página. Tente novamente em alguns instantes.",
    Icon: AlertTriangle,
  },
} as const;

const ErrorPage = ({ code = 404 }: ErrorPageProps) => {
  const location = useLocation();
  const { title, headline, description, Icon } = COPY[code];

  useEffect(() => {
    console.error(`[ErrorPage ${code}] Path: ${location.pathname}`);
  }, [code, location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="text-center max-w-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-6xl font-bold text-primary">{title}</h1>
          <p className="mt-3 text-lg font-semibold text-foreground">{headline}</p>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>

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
            {code === 500 && (
              <Button variant="outline" onClick={() => window.location.reload()}>
                <RefreshCcw className="mr-1.5 h-4 w-4" /> Recarregar
              </Button>
            )}
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
              <Link to="/ajuda" className="rounded-full bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground border border-border">
                Central de Ajuda
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ErrorPage;

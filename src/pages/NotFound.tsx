import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Search, Briefcase, UserPlus } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="text-center max-w-md">
          <h1 className="font-display text-5xl font-bold text-primary">404</h1>
          <p className="mt-3 text-lg font-semibold text-foreground">Página não encontrada</p>
          <p className="mt-2 text-sm text-muted-foreground">
            A página que você procura não existe ou foi removida.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link to="/">
                <Search className="mr-1.5 h-4 w-4" /> Buscar Profissionais
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/cadastro">
                <UserPlus className="mr-1.5 h-4 w-4" /> Cadastre-se
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/vagas">
                <Briefcase className="mr-1.5 h-4 w-4" /> Ver Vagas
              </Link>
            </Button>
          </div>
          <div className="mt-8 rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-sm font-medium text-foreground">Sugestões</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Link to="/blog" className="rounded-full bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground border border-border">
                Notícias
              </Link>
              <Link to="/categorias" className="rounded-full bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground border border-border">
                Categorias
              </Link>
              <Link to="/cidades" className="rounded-full bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground border border-border">
                Cidades
              </Link>
              <Link to="/faq" className="rounded-full bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground border border-border">
                FAQ
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default NotFound;

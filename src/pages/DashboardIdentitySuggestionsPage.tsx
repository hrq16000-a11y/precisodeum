import { useEffect } from 'react';
import { Link } from '@/lib/router-compat';
import { ArrowLeft } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IdentitySuggestionsWidget from '@/components/dashboard/IdentitySuggestionsWidget';
import { useSeoHead } from '@/hooks/useSeoHead';

const DashboardIdentitySuggestionsPage = () => {
  useSeoHead({
    title: 'Sugestões de identidade — Painel',
    description: 'Revise e aprove sugestões de alteração de identidade do seu perfil profissional.',
    noindex: true,
  });

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 py-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao painel
          </Link>

          <header className="mt-4 mb-6">
            <h1 className="font-display text-2xl font-bold text-foreground">
              Sugestões de identidade
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Detectamos divergências entre os dados do seu perfil principal e as informações
              que você usa em serviços, vagas e portfólio. Você decide o que aplicar — toda
              alteração é registrada no log de auditoria.
            </p>
          </header>

          <IdentitySuggestionsWidget hideViewAllLink />

          <div className="mt-6 rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            <strong className="text-foreground">Dica de governança:</strong> sugestões aplicadas
            atualizam imediatamente o seu nome, documento ou WhatsApp do perfil principal.
            Sugestões ignoradas são mantidas no histórico, mas não voltam a ser exibidas.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DashboardIdentitySuggestionsPage;

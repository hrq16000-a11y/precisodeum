import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';

const CookiesPage = () => {
  useSeoHead({ title: 'Política de Cookies - Preciso de um', description: 'Política de Cookies da plataforma Preciso de um.', canonical: `${SITE_BASE_URL}/cookies` });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-10">
        <div className="container max-w-3xl">
          <h1 className="font-display text-3xl font-bold text-foreground">Política de Cookies</h1>
          <p className="mt-2 text-sm text-muted-foreground">Última atualização: Março de 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. O que são cookies?</h2>
              <p className="mt-2">Cookies são pequenos arquivos de texto armazenados no seu dispositivo quando você visita um site. Eles são utilizados para lembrar suas preferências e melhorar sua experiência de navegação.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Tipos de cookies que utilizamos</h2>
              <p className="mt-2"><strong>Essenciais:</strong> Necessários para o funcionamento básico da plataforma (autenticação, sessão).</p>
              <p className="mt-1"><strong>Funcionais:</strong> Lembram suas preferências como cidade detectada e idioma.</p>
              <p className="mt-1"><strong>Analíticos:</strong> Nos ajudam a entender como a plataforma é utilizada para melhorias contínuas.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Gerenciamento de cookies</h2>
              <p className="mt-2">Você pode gerenciar ou bloquear cookies nas configurações do seu navegador. Note que desabilitar cookies essenciais pode afetar o funcionamento da plataforma.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Cookies de terceiros</h2>
              <p className="mt-2">Utilizamos serviços de terceiros que podem definir seus próprios cookies, como ferramentas de analytics e provedores de autenticação.</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CookiesPage;

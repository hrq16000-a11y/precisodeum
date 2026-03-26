import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';

const TermsPage = () => {
  useSeoHead({ title: 'Termos de Uso - Preciso de um', description: 'Termos de Uso da plataforma Preciso de um.', canonical: `${SITE_BASE_URL}/termos` });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-10">
        <div className="container max-w-3xl">
          <h1 className="font-display text-3xl font-bold text-foreground">Termos de Uso</h1>
          <p className="mt-2 text-sm text-muted-foreground">Última atualização: Março de 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. Aceitação dos Termos</h2>
              <p className="mt-2">Ao utilizar a plataforma Preciso de um, você concorda com estes Termos de Uso. Caso não concorde, não utilize a plataforma.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Descrição do Serviço</h2>
              <p className="mt-2">A plataforma conecta clientes a profissionais prestadores de serviços. Não somos responsáveis pela qualidade, pontualidade ou resultado dos serviços prestados por terceiros.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Cadastro</h2>
              <p className="mt-2">Para utilizar determinados recursos, é necessário criar uma conta. Você é responsável por manter a confidencialidade de suas credenciais e por todas as atividades realizadas em sua conta.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Responsabilidades do Usuário</h2>
              <p className="mt-2">O usuário se compromete a fornecer informações verdadeiras, não utilizar a plataforma para fins ilegais e respeitar os demais usuários da comunidade.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Propriedade Intelectual</h2>
              <p className="mt-2">Todo o conteúdo da plataforma, incluindo marca, logotipo, layout e funcionalidades, é de propriedade exclusiva da Ping Soluções.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Limitação de Responsabilidade</h2>
              <p className="mt-2">A plataforma é fornecida "como está". Não garantimos disponibilidade ininterrupta e não nos responsabilizamos por danos diretos ou indiretos decorrentes do uso.</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsPage;

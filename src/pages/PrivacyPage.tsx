import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';

const PrivacyPage = () => {
  useSeoHead({ title: 'Política de Privacidade - Preciso de um', description: 'Política de Privacidade da plataforma Preciso de um.', canonical: `${SITE_BASE_URL}/privacidade` });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-10">
        <div className="container max-w-3xl">
          <h1 className="font-display text-3xl font-bold text-foreground">Política de Privacidade</h1>
          <p className="mt-2 text-sm text-muted-foreground">Última atualização: Março de 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. Informações que coletamos</h2>
              <p className="mt-2">Coletamos informações pessoais fornecidas voluntariamente durante o cadastro, como nome, e-mail, telefone e dados profissionais. Também coletamos dados de navegação automaticamente, como endereço IP, tipo de navegador e páginas visitadas.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Como usamos suas informações</h2>
              <p className="mt-2">Utilizamos seus dados para: fornecer e melhorar nossos serviços; conectar clientes a profissionais; enviar comunicações relevantes; e garantir a segurança da plataforma.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Compartilhamento de dados</h2>
              <p className="mt-2">Não vendemos seus dados pessoais. Compartilhamos informações apenas quando necessário para a prestação dos serviços, cumprimento de obrigações legais ou com seu consentimento expresso.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Seus direitos (LGPD)</h2>
              <p className="mt-2">Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a: acessar, corrigir, excluir seus dados pessoais; solicitar portabilidade; revogar consentimento; e obter informações sobre compartilhamento.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Segurança</h2>
              <p className="mt-2">Implementamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, alteração, divulgação ou destruição.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Contato</h2>
              <p className="mt-2">Para questões relacionadas à privacidade, entre em contato pelo WhatsApp (41) 99745-2053 ou envie uma mensagem pela plataforma.</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPage;

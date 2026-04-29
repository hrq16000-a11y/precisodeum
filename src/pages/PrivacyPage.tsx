import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FadeInSection from '@/components/FadeInSection';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';

const PrivacyPage = () => {
  useSeoHead({
    title: 'Política de Privacidade - Preciso de um',
    description: 'Política de Privacidade da plataforma Preciso de um. Saiba como coletamos, usamos, compartilhamos, armazenamos e protegemos seus dados pessoais e do dispositivo, em conformidade com a LGPD e as políticas do Google Play.',
    canonical: `${SITE_BASE_URL}/privacidade`,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-10">
        <FadeInSection className="container max-w-3xl" blur={false}>
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="font-display text-3xl font-bold text-foreground"
          >
            Política de Privacidade
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-2 text-sm text-muted-foreground"
          >
            Última atualização: 29 de abril de 2026
          </motion.p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. Quem somos (controlador dos dados)</h2>
              <p className="mt-2">
                A plataforma <strong>Preciso de um Profissional</strong> (aplicativo Android e site
                <a href="https://precisodeum.com.br" className="text-accent hover:underline"> precisodeum.com.br</a>) é
                operada por <strong>Ping Soluções</strong> (nome fantasia "Preciso de um Tecnologia"),
                CNPJ 41.723.708/0001-58, com sede no Brasil. Para contato sobre privacidade,
                exclusão de conta ou exercício de direitos LGPD:
                e-mail <a href="mailto:contato@precisodeum.com.br" className="text-accent hover:underline">contato@precisodeum.com.br</a>
                {' '}ou WhatsApp (41) 99745-2053.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Dados que coletamos</h2>
              <p className="mt-2"><strong>2.1. Dados fornecidos por você:</strong> nome, e-mail, telefone/WhatsApp,
                cidade e estado, foto de perfil, descrição profissional, categorias de serviço, área de
                atendimento, portfólio (fotos/vídeos), CPF ou CNPJ (opcional, apenas para profissionais
                que desejam selo de verificação).</p>
              <p className="mt-2"><strong>2.2. Dados de autenticação:</strong> credenciais de login
                (e-mail/senha) e, se você optar, dados básicos do Google Sign-In (nome, e-mail e foto pública).</p>
              <p className="mt-2"><strong>2.3. Dados do dispositivo e uso (sensíveis):</strong> endereço IP,
                identificador anônimo do dispositivo, modelo, sistema operacional, versão do app, idioma,
                tipo de navegador, páginas visitadas, cliques, tempo de sessão e logs de erro. Esses dados
                são usados para segurança, prevenção a fraudes, métricas e melhoria do produto.</p>
              <p className="mt-2"><strong>2.4. Localização aproximada:</strong> se você conceder permissão,
                usamos sua localização (GPS ou IP) <em>apenas</em> para mostrar profissionais e serviços
                próximos. Você pode revogar essa permissão a qualquer momento nas configurações do
                dispositivo. Não rastreamos sua localização em segundo plano.</p>
              <p className="mt-2"><strong>2.5. Conteúdo enviado:</strong> mensagens em chat, avaliações,
                comentários e mídias (fotos/vídeos) que você publicar voluntariamente.</p>
              <p className="mt-2"><strong>2.6. Cookies e tecnologias similares:</strong> consulte nossa
                {' '}<Link to="/cookies" className="text-accent hover:underline">Política de Cookies</Link>.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Como usamos seus dados</h2>
              <p className="mt-2">Usamos seus dados para: (a) criar e manter sua conta; (b) conectar
                clientes a profissionais por meio de busca por proximidade; (c) enviar notificações
                transacionais (confirmação de cadastro, recuperação de senha, novos leads, status de
                serviço); (d) prevenir fraudes, abusos e violações dos Termos; (e) cumprir obrigações
                legais, fiscais e regulatórias; (f) melhorar a plataforma com base em métricas agregadas.</p>
              <p className="mt-2">Não usamos seus dados para tomada de decisão automatizada com efeitos
                jurídicos relevantes, nem para publicidade comportamental de terceiros.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Compartilhamento de dados</h2>
              <p className="mt-2">Não vendemos seus dados pessoais. Compartilhamos apenas o estritamente
                necessário com:</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li><strong>Outros usuários da plataforma:</strong> seu nome público, foto, cidade,
                  categorias e portfólio ficam visíveis para clientes que buscam profissionais. Seu
                  WhatsApp/telefone só é exibido quando você opta por torná-lo público no perfil.</li>
                <li><strong>Provedores de infraestrutura (operadores):</strong> Supabase (banco de dados
                  e autenticação, hospedado em datacenters seguros), Resend (envio de e-mails
                  transacionais), Google Cloud (autenticação Google Sign-In) e provedores de CDN.
                  Todos atuam sob contrato e cláusulas de proteção de dados.</li>
                <li><strong>Autoridades competentes:</strong> mediante ordem judicial ou requisição
                  legal válida.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Segurança dos dados</h2>
              <p className="mt-2">Adotamos medidas técnicas e organizacionais para proteger seus dados:
                criptografia em trânsito (HTTPS/TLS), criptografia em repouso no banco de dados,
                Row-Level Security (RLS) em todas as tabelas, autenticação por token JWT, hashing de
                senhas, logs de auditoria, controle de acesso por papel (RBAC) e monitoramento contínuo.
                Apesar dos esforços, nenhum sistema é 100% seguro; em caso de incidente, comunicaremos
                você e a ANPD conforme a LGPD.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Retenção e exclusão de dados</h2>
              <p className="mt-2">Mantemos seus dados enquanto sua conta estiver ativa. Após a solicitação
                de exclusão:</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li><strong>Excluídos imediatamente após o período de carência de 30 dias:</strong> nome,
                  e-mail, telefone, foto, descrição, portfólio, mensagens, avaliações, dados do
                  dispositivo e localização.</li>
                <li><strong>Mantidos por obrigação legal:</strong> dados financeiros e fiscais por até
                  5 anos (Código Civil e legislação tributária); logs de acesso por até 12 meses
                  (Marco Civil da Internet, Lei 12.965/2014).</li>
              </ul>
              <p className="mt-2">Você pode solicitar a exclusão a qualquer momento em
                {' '}<Link to="/excluir-conta" className="text-accent hover:underline">/excluir-conta</Link>{' '}
                ou pelo e-mail acima.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">7. Seus direitos (LGPD)</h2>
              <p className="mt-2">Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem
                direito a: confirmar a existência de tratamento; acessar seus dados; corrigir dados
                incompletos ou desatualizados; anonimizar, bloquear ou excluir dados desnecessários;
                solicitar portabilidade; revogar consentimento; e obter informações sobre o
                compartilhamento. Para exercer qualquer direito, escreva para
                {' '}<a href="mailto:contato@precisodeum.com.br" className="text-accent hover:underline">contato@precisodeum.com.br</a>.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">8. Crianças e adolescentes</h2>
              <p className="mt-2">A plataforma <strong>não é direcionada a crianças menores de 13 anos</strong>.
                Não coletamos intencionalmente dados de menores de 13 anos. Usuários entre 13 e 18 anos
                devem usar a plataforma apenas com supervisão e consentimento dos responsáveis legais.
                Se identificarmos dados de uma criança menor de 13 anos, eles serão excluídos
                imediatamente. Se você é responsável legal e suspeita que coletamos dados de seu
                filho(a), entre em contato pelo e-mail acima.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">9. Permissões do app Android</h2>
              <p className="mt-2">O app pode solicitar as seguintes permissões, sempre com finalidade
                clara e revogável a qualquer momento nas configurações do dispositivo:</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li><strong>Localização aproximada:</strong> mostrar profissionais próximos.</li>
                <li><strong>Câmera e galeria:</strong> enviar foto de perfil e portfólio.</li>
                <li><strong>Notificações:</strong> avisos de novos leads e mensagens.</li>
                <li><strong>Internet e estado da rede:</strong> funcionamento básico do app.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">10. Transferência internacional</h2>
              <p className="mt-2">Alguns provedores de infraestrutura podem armazenar dados em servidores
                fora do Brasil (ex.: Estados Unidos e União Europeia). Garantimos que essas transferências
                ocorrem com cláusulas contratuais adequadas e em países com nível de proteção
                considerado adequado pela ANPD.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">11. Alterações nesta política</h2>
              <p className="mt-2">Podemos atualizar esta política periodicamente. Mudanças relevantes
                serão comunicadas pelo app ou e-mail. A data de "última atualização" no topo desta
                página indica a versão vigente.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">12. Encarregado e contato</h2>
              <p className="mt-2"><strong>Encarregado pelo Tratamento de Dados (DPO):</strong> Ping Soluções —
                Preciso de um Tecnologia.<br />
                <strong>E-mail:</strong> <a href="mailto:contato@precisodeum.com.br" className="text-accent hover:underline">contato@precisodeum.com.br</a><br />
                <strong>WhatsApp:</strong> (41) 99745-2053<br />
                <strong>CNPJ:</strong> 41.723.708/0001-58
              </p>
            </section>
          </div>
        </FadeInSection>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPage;

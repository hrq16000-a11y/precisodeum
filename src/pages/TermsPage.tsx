import { motion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FadeInSection from "@/components/FadeInSection";
import { useSeoHead, SITE_BASE_URL } from "@/hooks/useSeoHead";

const TermsPage = () => {
  useSeoHead({
    title: "Termos de Uso - Preciso de um",
    description:
      "Termos de Uso da plataforma Preciso de um: regras da comunidade, uso do serviço, responsabilidades, direitos autorais e procedimento de denúncias.",
    canonical: `${SITE_BASE_URL}/termos`,
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
            Termos de Uso
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-2 text-sm text-muted-foreground"
          >
            Última atualização: Abril de 2026
          </motion.p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. Aceitação dos Termos</h2>
              <p className="mt-2">
                Ao criar uma conta ou utilizar a plataforma Preciso de Um (operada por Ping
                Soluções, CNPJ 41.723.708/0001-58), você concorda com estes Termos de Uso, com a{" "}
                <a href="/privacidade" className="text-accent hover:underline">
                  Política de Privacidade
                </a>{" "}
                e com a{" "}
                <a href="/cookies" className="text-accent hover:underline">
                  Política de Cookies
                </a>
                . Caso não concorde, não utilize a plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Descrição do Serviço</h2>
              <p className="mt-2">
                A plataforma conecta clientes a profissionais prestadores de serviços por meio de
                listagens, busca por categoria e cidade, perfis públicos e contato direto. A
                negociação, contratação, pagamento e execução do serviço acontecem diretamente
                entre as partes — não somos parte do contrato firmado entre cliente e profissional.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Cadastro e segurança da conta</h2>
              <p className="mt-2">
                Para usar recursos restritos é necessário criar uma conta com informações
                verdadeiras e atualizadas. Você é responsável por manter a confidencialidade das
                suas credenciais e por todas as atividades realizadas na sua conta. Comunique
                imediatamente qualquer uso não autorizado pelo e-mail{" "}
                <a href="mailto:contato@precisodeum.com.br" className="text-accent hover:underline">
                  contato@precisodeum.com.br
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Regras da comunidade</h2>
              <p className="mt-2">
                Ao usar a plataforma você concorda em <strong>NÃO</strong>:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Publicar conteúdo ilegal, ofensivo, discriminatório, violento ou sexualmente explícito;</li>
                <li>Usar a plataforma para fraude, golpe, lavagem de dinheiro ou qualquer atividade ilícita;</li>
                <li>Se passar por outra pessoa, empresa ou profissional, ou usar identidade falsa;</li>
                <li>Coletar dados de outros usuários por meios automatizados (scraping, bots);</li>
                <li>Tentar burlar limites do plano, mecanismos de ranking ou sistemas antifraude;</li>
                <li>Enviar spam, mensagens em massa não solicitadas ou conteúdo enganoso;</li>
                <li>Publicar conteúdo que viole direitos de terceiros (imagem, marca, autoria);</li>
                <li>Solicitar ou divulgar dados sensíveis de terceiros sem autorização.</li>
              </ul>
              <p className="mt-2">
                A violação destas regras pode resultar em advertência, remoção de conteúdo,
                suspensão temporária ou exclusão definitiva da conta, sem prejuízo das medidas
                legais cabíveis.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Conteúdo publicado por usuários</h2>
              <p className="mt-2">
                Você é o único responsável pelo conteúdo que publica (textos, fotos, vídeos,
                serviços, avaliações). Ao publicar, você declara ser titular dos direitos
                necessários e concede à Preciso de Um licença não exclusiva, mundial e gratuita
                para hospedar, exibir, redimensionar e distribuir esse conteúdo dentro da
                plataforma e em peças de divulgação relacionadas, durante o período em que ele
                permanecer publicado.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Direitos autorais e propriedade intelectual</h2>
              <p className="mt-2">
                A marca Preciso de Um, o logotipo, o layout, o código-fonte, os textos editoriais
                e as funcionalidades são de propriedade exclusiva da Ping Soluções e estão
                protegidos pela Lei 9.610/98 (Direitos Autorais) e Lei 9.279/96 (Propriedade
                Industrial). É proibido reproduzir, modificar, distribuir ou criar trabalhos
                derivados sem autorização prévia por escrito.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">7. Procedimento de denúncias e remoção (notice & takedown)</h2>
              <p className="mt-2">
                Para denunciar conteúdo que viole estes Termos, infrinja direitos autorais ou
                envolva conduta inadequada de outro usuário, envie um e-mail para{" "}
                <a href="mailto:contato@precisodeum.com.br" className="text-accent hover:underline">
                  contato@precisodeum.com.br
                </a>{" "}
                contendo:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Identificação do denunciante (nome completo e contato);</li>
                <li>URL ou identificação clara do conteúdo/perfil denunciado;</li>
                <li>Descrição objetiva do problema e a regra/lei supostamente violada;</li>
                <li>Em caso de direitos autorais: comprovação da titularidade;</li>
                <li>Declaração de boa-fé sobre a veracidade das informações.</li>
              </ul>
              <p className="mt-2">
                Analisaremos a denúncia em até 7 dias úteis. Quando cabível, removeremos o conteúdo
                e notificaremos o usuário responsável, garantindo direito de contraditório.
                Conteúdos manifestamente ilegais (apologia ao crime, exploração de menores) são
                removidos imediatamente e reportados às autoridades competentes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">8. Responsabilidade</h2>
              <p className="mt-2">
                A plataforma é fornecida "como está", sem garantia de disponibilidade
                ininterrupta. Não nos responsabilizamos pela qualidade, pontualidade, segurança ou
                resultado dos serviços prestados por profissionais cadastrados — atuamos apenas
                como intermediário tecnológico. Recomendamos sempre verificar referências,
                contratar formalmente e exigir notas fiscais.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">9. Encerramento e exclusão de conta</h2>
              <p className="mt-2">
                Você pode encerrar sua conta a qualquer momento em{" "}
                <a href="/excluir-conta" className="text-accent hover:underline">
                  /excluir-conta
                </a>
                . Reservamos o direito de suspender ou encerrar contas que violem estes Termos. O
                tratamento posterior dos dados segue a Política de Privacidade.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">10. Alterações dos Termos</h2>
              <p className="mt-2">
                Podemos atualizar estes Termos a qualquer momento. Mudanças relevantes serão
                comunicadas por e-mail e/ou aviso destacado na plataforma com pelo menos 7 dias de
                antecedência. O uso continuado após a vigência configura aceitação.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">11. Lei aplicável e foro</h2>
              <p className="mt-2">
                Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito
                o foro da comarca da sede da empresa para dirimir controvérsias, ressalvado o
                direito do consumidor de eleger seu domicílio.
              </p>
            </section>
          </div>
        </FadeInSection>
      </main>
      <Footer />
    </div>
  );
};

export default TermsPage;

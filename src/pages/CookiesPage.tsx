import { useState } from "react";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FadeInSection from "@/components/FadeInSection";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSeoHead, SITE_BASE_URL } from "@/hooks/useSeoHead";
import {
  acceptAll,
  rejectAll,
  saveConsent,
  getConsent,
  DEFAULT_CONSENT,
} from "@/lib/cookieConsent";
import { toast } from "sonner";

const CookiesPage = () => {
  useSeoHead({
    title: "Política de Cookies - Preciso de um",
    description:
      "Política de Cookies da Preciso de um: tecnologias usadas, finalidades, base legal e como gerenciar seu consentimento.",
    canonical: `${SITE_BASE_URL}/cookies`,
  });

  const initial = getConsent() ?? DEFAULT_CONSENT;
  const [prefs, setPrefs] = useState({
    functional: initial.functional,
    analytics: initial.analytics,
    marketing: initial.marketing,
  });

  const save = () => {
    saveConsent(prefs);
    toast.success("Preferências de cookies atualizadas.");
  };

  const reset = () => {
    rejectAll();
    setPrefs({ functional: false, analytics: false, marketing: false });
    toast.success("Consentimento revogado. Apenas cookies essenciais permanecem ativos.");
  };

  const allOn = () => {
    acceptAll();
    setPrefs({ functional: true, analytics: true, marketing: true });
    toast.success("Todos os cookies foram aceitos.");
  };

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
            Política de Cookies
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
              <h2 className="text-lg font-semibold text-foreground">1. O que são cookies</h2>
              <p className="mt-2">
                Cookies e tecnologias similares (localStorage, sessionStorage, pixels e SDKs) são
                pequenos identificadores armazenados no seu dispositivo para reconhecer sua sessão,
                lembrar preferências e mensurar o uso da plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Categorias e finalidades</h2>
              <p className="mt-2">Organizamos os cookies em quatro categorias:</p>
              <div className="mt-4 overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-foreground">
                    <tr>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Tecnologias</th>
                      <th className="p-3">Finalidade</th>
                      <th className="p-3">Base legal (LGPD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="p-3 font-medium text-foreground">Essenciais</td>
                      <td className="p-3">Sessão Supabase Auth, CSRF, localStorage de sessão</td>
                      <td className="p-3">Login, segurança e funcionamento básico</td>
                      <td className="p-3">Execução de contrato e legítimo interesse</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-foreground">Funcionais</td>
                      <td className="p-3">localStorage (cidade, tema, rascunhos), Service Worker</td>
                      <td className="p-3">Lembrar preferências e suporte offline</td>
                      <td className="p-3">Consentimento</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-foreground">Analíticos</td>
                      <td className="p-3">Telemetria interna agregada (Web Vitals, eventos UI)</td>
                      <td className="p-3">Entender uso para melhorias de produto</td>
                      <td className="p-3">Consentimento</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-foreground">Marketing</td>
                      <td className="p-3">Pixels de conversão e mensuração de campanhas</td>
                      <td className="p-3">Mensurar campanhas e exibir conteúdo de patrocinadores</td>
                      <td className="p-3">Consentimento</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Suas escolhas</h2>
              <p className="mt-2">
                Você pode aceitar todos, recusar todos ou escolher por categoria. Cookies
                essenciais não podem ser desativados, pois são necessários para o site funcionar.
                Suas preferências são salvas neste navegador e podem ser alteradas a qualquer
                momento abaixo.
              </p>

              <div className="mt-4 space-y-3">
                <CategoryRow
                  title="Essenciais"
                  activatesWhenOn="Login, sessão Supabase Auth, segurança e roteamento"
                  deactivatesWhenOff="Não pode ser desativado — necessário para o site funcionar"
                  policyLink={{ to: "/privacidade", label: "Política de Privacidade" }}
                  checked
                  disabled
                />
                <CategoryRow
                  title="Funcionais"
                  activatesWhenOn="Lembrar cidade, tema, rascunhos e suporte offline (Service Worker)"
                  deactivatesWhenOff="Você precisará reconfigurar preferências a cada visita"
                  policyLink={{ to: "/cookies", label: "Detalhes nesta página, seção 2" }}
                  checked={prefs.functional}
                  onChange={(v) => setPrefs((p) => ({ ...p, functional: v }))}
                />
                <CategoryRow
                  title="Analíticos"
                  activatesWhenOn="Web Vitals e eventos UI agregados para melhorias de produto"
                  deactivatesWhenOff="Sua sessão não conta para estatísticas internas"
                  policyLink={{ to: "/privacidade", label: "Política de Privacidade" }}
                  checked={prefs.analytics}
                  onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
                />
                <CategoryRow
                  title="Marketing"
                  activatesWhenOn="Pixels de conversão e exibição de patrocinadores relevantes"
                  deactivatesWhenOff="Pixels de marketing são bloqueados imediatamente e cookies de campanha removidos"
                  policyLink={{ to: "/termos", label: "Termos de Uso (regras de patrocínio)" }}
                  checked={prefs.marketing}
                  onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="accent" onClick={save}>
                  Salvar preferências
                </Button>
                <Button variant="outline" onClick={allOn}>
                  Aceitar todos
                </Button>
                <Button variant="ghost" onClick={reset}>
                  Revogar consentimento
                </Button>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Cookies de terceiros</h2>
              <p className="mt-2">
                Alguns recursos são fornecidos por terceiros (autenticação Google, mapas, provedor
                de e-mails). Esses parceiros podem definir cookies próprios conforme suas próprias
                políticas. Mantemos a lista revisada e atualizada nesta página.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Gerenciamento no navegador</h2>
              <p className="mt-2">
                Além dos controles acima, você pode bloquear ou apagar cookies nas configurações do
                seu navegador. Note que desativar cookies essenciais pode impedir o funcionamento
                de partes do site.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Contato</h2>
              <p className="mt-2">
                Dúvidas sobre cookies ou tratamento de dados? Fale com nosso encarregado em{" "}
                <a href="mailto:contato@precisodeum.com.br" className="text-accent hover:underline">
                  contato@precisodeum.com.br
                </a>
                .
              </p>
            </section>
          </div>
        </FadeInSection>
      </main>
      <Footer />
    </div>
  );
};

function CategoryRow({
  title,
  activatesWhenOn,
  deactivatesWhenOff,
  policyLink,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  activatesWhenOn: string;
  deactivatesWhenOff: string;
  policyLink?: { to: string; label: string };
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-3">
      <div className="flex-1 space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          <strong>Ao ativar:</strong> {activatesWhenOn}
        </p>
        <p className="text-xs text-muted-foreground">
          <strong>Ao desativar:</strong> {deactivatesWhenOff}
        </p>
        {policyLink && (
          <a href={policyLink.to} className="inline-block text-xs text-accent hover:underline">
            {policyLink.label}
          </a>
        )}
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={`Ativar categoria ${title}`}
      />
    </div>
  );
}

export default CookiesPage;

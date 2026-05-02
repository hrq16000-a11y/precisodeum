import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileText, ShieldCheck, Trash2, Cookie, Loader2, FileLock2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSeoHead, SITE_BASE_URL } from "@/hooks/useSeoHead";
import { toast } from "sonner";
import DashboardGroupNav from "@/components/dashboard/DashboardGroupNav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { RegistrationDataSummary } from "@/components/dashboard/RegistrationDataSummary";
import { MetaTrackingSummary } from "@/components/dashboard/MetaTrackingSummary";
import { DeleteAccountDialog } from "@/components/dashboard/DeleteAccountDialog";

const FUNCTION_URL = (name: string) =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;

const DashboardPrivacyPage = () => {
  useSeoHead({
    title: "Privacidade e meus dados | Preciso de Um",
    description:
      "Baixe um relatório completo dos seus dados pessoais tratados pela plataforma e gerencie suas preferências de privacidade.",
    canonical: `${SITE_BASE_URL}/dashboard/privacidade`,
  });

  const { user, profile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleExport = async () => {
    if (!user) {
      toast.error("Faça login para exportar seus dados.");
      return;
    }
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");

      const res = await fetch(FUNCTION_URL("user-data-export"), {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Falha ao gerar relatório (${res.status}). ${txt}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meus-dados-precisodeum-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Relatório baixado com sucesso.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o relatório.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-6">
        <div className="container max-w-4xl">
          <DashboardGroupNav />

          <header className="mb-6">
            <h1 className="font-display text-2xl font-bold text-foreground">
              Privacidade e meus dados
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Direitos garantidos pela LGPD: acesso, portabilidade, correção e eliminação.
            </p>
          </header>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Download className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Relatório de dados tratados
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Gere um arquivo <strong>JSON</strong> com todos os dados pessoais que tratamos
                  sobre você. O arquivo segue um formato aberto e pode ser importado em outras
                  ferramentas (portabilidade — LGPD Art. 18, V).
                </p>

                <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
                  <p className="font-semibold text-foreground">O que está incluído no arquivo</p>
                  <ul className="mt-1.5 grid list-disc gap-1 pl-5 text-muted-foreground sm:grid-cols-2">
                    <li>Dados da conta de autenticação (e-mail, telefone, datas)</li>
                    <li>Perfil público e configurações da página</li>
                    <li>Serviços, categorias e portfólio</li>
                    <li>Leads recebidos, histórico e interações</li>
                    <li>Mensagens de chat enviadas e recebidas</li>
                    <li>Avaliações dadas e recebidas</li>
                    <li>Notificações e preferências de notificação</li>
                    <li>Favoritos e indicações</li>
                    <li>Mídias (referências e metadados)</li>
                    <li>Pontos de engajamento e papéis (roles)</li>
                    <li>Logs de acesso vinculados à sua conta</li>
                    <li>Solicitações anteriores de exclusão</li>
                  </ul>
                  <p className="mt-2 text-muted-foreground">
                    <strong className="text-foreground">Tempo estimado:</strong> 5 a 30 segundos
                    para a maioria das contas. Contas com muitos leads, mensagens ou mídias podem
                    levar até 1 a 2 minutos. O download começa automaticamente assim que o
                    arquivo é gerado.
                  </p>
                </div>

                <div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p>
                    <strong className="text-foreground">Conta:</strong>{" "}
                    {profile?.full_name || user?.email || "—"}
                  </p>
                  <p>
                    <strong className="text-foreground">Base legal:</strong> LGPD Art. 18, V
                    (portabilidade) e Art. 19 (acesso).
                  </p>
                </div>
                <Button
                  onClick={handleExport}
                  disabled={loading || !user}
                  variant="accent"
                  className="mt-4"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando relatório...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Baixar meus dados (JSON)
                    </>
                  )}
                </Button>
              </div>
            </div>
          </section>

          <div className="mt-4">
            <RegistrationDataSummary userId={user?.id} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <PrivacyLink
              to="/privacidade"
              icon={ShieldCheck}
              title="Política de Privacidade"
              description="Como coletamos, usamos e protegemos seus dados."
            />
            <PrivacyLink
              to="/cookies"
              icon={Cookie}
              title="Política de Cookies"
              description="Categorias, finalidades e gerenciamento de consentimento."
            />
            <PrivacyLink
              to="/dashboard/auditoria-consentimentos"
              icon={Cookie}
              title="Auditoria de consentimentos"
              description="Histórico de aceites e mudanças de preferências de cookies."
            />
            <PrivacyLink
              to="/dashboard/meu-cadastro"
              icon={FileLock2}
              title="Registro de cadastro (LGPD)"
              description="Arquivo imutável com IP, dispositivo, endereço e origem do seu cadastro."
            />
            <PrivacyLink
              to="/termos"
              icon={FileText}
              title="Termos de Uso"
              description="Regras da comunidade, denúncias e responsabilidades."
            />
            <PrivacyLink
              to="/excluir-conta"
              icon={Trash2}
              title="Excluir minha conta (fluxo padrão)"
              description="Solicitação revisada por nossa equipe em até 30 dias."
              destructive
            />
          </div>

          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-destructive">Excluir agora (1 clique)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Desativa imediatamente, arquiva seus dados em "cold storage" por 90 dias e bloqueia
              recadastro com mesmo e-mail, WhatsApp ou dispositivo por 180 dias.
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="mt-3"
              onClick={handleSelfDelete}
              disabled={deleting || !user}
            >
              {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando…</> : <>Excluir agora</>}
            </Button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Encarregado de tratamento de dados (DPO):{" "}
            <a
              href="mailto:contato@precisodeum.com.br"
              className="text-accent hover:underline"
            >
              contato@precisodeum.com.br
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

function PrivacyLink({
  to,
  icon: Icon,
  title,
  description,
  destructive,
}: {
  to: string;
  icon: React.ElementType;
  title: string;
  description: string;
  destructive?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40 ${
        destructive ? "hover:border-destructive/50" : ""
      }`}
    >
      <div
        className={`rounded-lg p-2 ${
          destructive
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/10 text-primary"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

export default DashboardPrivacyPage;

import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithGuard, EDGE_GUARD_FALLBACK_MESSAGE } from "@/lib/edgeInvoke";
import { useSeoHead, SITE_BASE_URL } from "@/hooks/useSeoHead";
import { toast } from "sonner";
import { toastAssertiveError } from "@/lib/a11yToast";
import { CheckCircle2, AlertCircle, ShieldCheck, Mail, Trash2 } from "lucide-react";
import { isValidEmail, EMAIL_INVALID_MESSAGE } from "@/lib/validation/emailValidation";

const APP_NAME = "Preciso de Um";
const DEVELOPER_NAME = "Preciso de Um Tecnologia";
const SUPPORT_EMAIL = "contato@precisodeum.com.br";

type Status = "idle" | "sending" | "sent" | "error";

const AccountDeletionPage = () => {
  useSeoHead({
    title: `Excluir minha conta | ${APP_NAME}`,
    description: `Solicite a exclusão da sua conta e dos seus dados pessoais no ${APP_NAME}. Atendemos a LGPD e às políticas do Google Play.`,
    canonical: `${SITE_BASE_URL}/excluir-conta`,
  });

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [protocol, setProtocol] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!isValidEmail(email)) {
      setErrorMsg(EMAIL_INVALID_MESSAGE);
      return;
    }
    if (!confirmed) {
      setErrorMsg("Confirme que entendeu o que será excluído antes de continuar.");
      return;
    }
    setStatus("sending");
    try {
      const res = await invokeWithGuard<{ request_id?: string }>("request-account-deletion", {
        body: {
          email: email.trim().toLowerCase(),
          full_name: fullName.trim() || undefined,
          reason: reason.trim() || undefined,
        },
        // Usuário final em rede móvel — 35s comporta cold start + 3G instável
        timeoutProfile: 'user',
      });
      if (res.timedOut) {
        setStatus("error");
        setErrorMsg(EDGE_GUARD_FALLBACK_MESSAGE);
        toastAssertiveError(EDGE_GUARD_FALLBACK_MESSAGE);
        return;
      }
      if (res.error) throw res.error;
      setProtocol(res.data?.request_id ?? null);
      setStatus("sent");
      toast.success("Solicitação de exclusão registrada.");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMsg("Não foi possível enviar agora. Tente novamente em instantes.");
      toast.error("Erro ao registrar solicitação.");
    }
  };

  return (
    <div className="min-h-screen bg-background">

      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-display text-lg font-bold">
            {APP_NAME}
          </Link>
          <Link to="/ajuda" className="text-sm text-muted-foreground hover:text-foreground">
            Ajuda
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10">
            <Trash2 className="h-5 w-5 text-destructive" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
              Excluir minha conta no {APP_NAME}
            </h1>
            <p className="text-sm text-muted-foreground">
              Sua privacidade importa. Veja exatamente o que acontece quando você solicita a exclusão.
            </p>
          </div>
        </div>

        <section className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Como solicitar a exclusão
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground/90">
            <li>Preencha o formulário abaixo com o e-mail cadastrado e (opcional) o motivo.</li>
            <li>Você receberá um e-mail de confirmação com o protocolo da solicitação.</li>
            <li>
              Sua conta entra em <strong>período de carência de 30 dias</strong>. Durante esse
              tempo o perfil deixa de aparecer publicamente e a exclusão pode ser cancelada respondendo
              o e-mail de confirmação.
            </li>
            <li>
              Após 30 dias, sua conta e os dados pessoais associados são <strong>excluídos definitivamente</strong>.
            </li>
            <li>
              Alternativa: usuários autenticados também podem usar o painel em{" "}
              <Link to="/dashboard/configuracoes" className="text-primary hover:underline">
                Configurações da conta
              </Link>{" "}
              para iniciar o processo logado.
            </li>
          </ol>
        </section>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
            <h2 className="text-sm font-semibold text-destructive">O que será excluído</h2>
            <ul className="mt-2 space-y-1.5 pl-5 text-sm text-foreground/90 list-disc">
              <li>Perfil, nome, foto e dados de contato</li>
              <li>Telefone, endereço e localização</li>
              <li>Serviços, fotos do portfólio e descrições</li>
              <li>Mensagens, leads e solicitações recebidas</li>
              <li>Avaliações enviadas (anonimizadas, não removidas)</li>
              <li>Notificações, preferências e tokens de sessão</li>
            </ul>
          </section>

          <section className="rounded-xl border bg-muted/30 p-5">
            <h2 className="text-sm font-semibold">O que pode ser mantido</h2>
            <ul className="mt-2 space-y-1.5 pl-5 text-sm text-foreground/90 list-disc">
              <li>
                Registros financeiros e fiscais por <strong>até 5 anos</strong> (exigência legal —
                Receita Federal).
              </li>
              <li>
                Logs de auditoria e segurança anonimizados por <strong>até 12 meses</strong> para
                prevenção de fraude.
              </li>
              <li>
                Dados agregados e anonimizados que não permitem te identificar (estatísticas de uso).
              </li>
            </ul>
          </section>
        </div>

        <section className="mt-6 rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
            Formulário de solicitação
          </h2>

          {status === "sent" ? (
            <div className="mt-4 flex items-start gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Solicitação registrada com sucesso.</p>
                <p className="mt-1">
                  Enviamos uma confirmação para <strong>{email}</strong>. A exclusão definitiva
                  está agendada para daqui a 30 dias.
                </p>
                {protocol && (
                  <p className="mt-1 text-xs">
                    Protocolo: <code className="rounded bg-background/60 px-1">{protocol}</code>
                  </p>
                )}
                <p className="mt-2 text-xs">
                  Para cancelar, responda o e-mail recebido ou escreva para{" "}
                  <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
                    {SUPPORT_EMAIL}
                  </a>
                  .
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="del-email">E-mail cadastrado *</Label>
                <Input
                  id="del-email"
                  type="email"
                  required
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="del-name">Nome completo (opcional)</Label>
                <Input
                  id="del-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Como você assinou no cadastro"
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="del-reason">Motivo (opcional)</Label>
                <Textarea
                  id="del-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Conte rapidamente o motivo. Isso nos ajuda a melhorar."
                  maxLength={2000}
                  rows={3}
                />
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground/90">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  Entendi que após 30 dias minha conta e meus dados pessoais serão excluídos
                  definitivamente, exceto registros mantidos por exigência legal.
                </span>
              </label>

              {errorMsg && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <Button
                type="submit"
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={status === "sending"}
              >
                {status === "sending" ? "Enviando..." : "Solicitar exclusão da conta"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Ao enviar, você confirma a leitura das informações acima. Esta solicitação atende à
                LGPD (Lei 13.709/2018) e às políticas do Google Play.
              </p>
            </form>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          App: <strong>{APP_NAME}</strong> · Desenvolvedor: <strong>{DEVELOPER_NAME}</strong> ·{" "}
          <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>{" "}
          ·{" "}
          <Link to="/privacidade" className="underline">
            Política de Privacidade
          </Link>
        </p>
      </main>
    </div>
  );
};

export default AccountDeletionPage;

/**
 * DeleteAccountDialog — modal vermelho de auto-exclusão (LGPD).
 *
 * Disparado pelo botão "Excluir agora" em /dashboard/privacidade.
 * Exige confirmação explícita + Select obrigatório de motivo de saída
 * antes de chamar o RPC `self_delete_account(_reason)`. Em caso de sucesso,
 * dispara toast de despedida e redireciona para a Home (deslogado).
 */
import { useState } from "react";
import { Loader2, ShieldAlert, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SelfDeleteReason =
  | "no_longer_use"
  | "found_other_app"
  | "few_leads"
  | "privacy_concern"
  | "technical_issues"
  | "other";

const REASONS: { value: SelfDeleteReason; label: string }[] = [
  { value: "no_longer_use", label: "Não preciso mais do serviço" },
  { value: "found_other_app", label: "Encontrei outro aplicativo" },
  { value: "few_leads", label: "Recebi poucos contatos / clientes" },
  { value: "privacy_concern", label: "Preocupação com privacidade dos meus dados" },
  { value: "technical_issues", label: "Problemas técnicos / dificuldades de uso" },
  { value: "other", label: "Outro motivo" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado depois do logout/redirect — útil para testes. */
  onCompleted?: () => void;
  signOut?: () => Promise<void> | void;
}

export function DeleteAccountDialog({ open, onOpenChange, onCompleted, signOut }: Props) {
  const [reason, setReason] = useState<SelfDeleteReason | "">("");
  const [otherText, setOtherText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!reason && (reason !== "other" || otherText.trim().length >= 3) && !submitting;

  const reset = () => {
    setReason("");
    setOtherText("");
    setSubmitting(false);
  };

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const reasonPayload =
        reason === "other"
          ? `other:${otherText.trim().slice(0, 240)}`
          : (reason as string);

      const { error } = await (supabase.rpc as any)("self_delete_account", {
        _reason: reasonPayload,
      });
      if (error) throw error;

      toast.success(
        "Sua conta foi arquivada. Cuide-se — sentiremos sua falta.",
        { duration: 4500 },
      );

      // Aguarda o toast aparecer e desconecta + redireciona para a Home.
      setTimeout(async () => {
        try { await signOut?.(); } catch { /* noop */ }
        try { onCompleted?.(); } catch { /* noop */ }
        window.location.href = "/";
      }, 1200);
    } catch (e: any) {
      console.error("[self-delete]", e);
      toast.error(e?.message || "Falha ao excluir agora. Tente novamente em instantes.");
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className="border-destructive/40">
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <AlertDialogTitle className="text-center text-destructive">
            Excluir minha conta agora
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-left text-destructive">
                Esta ação é definitiva. Seus dados serão arquivados por
                <strong> 90 dias </strong>conforme a LGPD e você
                <strong> não poderá criar uma nova conta</strong> com este
                WhatsApp, e-mail ou dispositivo por <strong>180 dias</strong>.
              </p>

              <div className="text-left">
                <label
                  htmlFor="self-delete-reason"
                  className="mb-1 block text-xs font-semibold text-foreground"
                >
                  Por que você está saindo? <span className="text-destructive">*</span>
                </label>
                <Select
                  value={reason}
                  onValueChange={(v) => setReason(v as SelfDeleteReason)}
                  disabled={submitting}
                >
                  <SelectTrigger id="self-delete-reason" data-testid="self-delete-reason">
                    <SelectValue placeholder="Selecione um motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {reason === "other" ? (
                  <textarea
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value.slice(0, 240))}
                    rows={3}
                    placeholder="Conte rapidamente o motivo (mín. 3 caracteres)…"
                    className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                    disabled={submitting}
                    data-testid="self-delete-other-text"
                  />
                ) : null}
              </div>

              <p className="text-left text-[11px] text-muted-foreground">
                Ao confirmar, você será deslogado e levado de volta à página inicial.
                O motivo será registrado de forma anônima para melhorarmos o produto.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            asChild
            // Evita o autoclose do Radix antes da confirmação assíncrona
            onClick={(e) => e.preventDefault()}
          >
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!canSubmit}
              data-testid="self-delete-confirm"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando…
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir definitivamente
                </>
              )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteAccountDialog;

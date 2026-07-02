import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
  MessageCircle,
  ShieldCheck,
  AlertCircle,
  Info,
  Loader2,
  ListChecks,
} from 'lucide-react';
import {
  useRegisterWhatsappClick,
  useWhatsappQuota,
  WhatsappQuotaExceededError,
} from '@/hooks/useWhatsappQuota';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string | null;
  providerName?: string | null;
  /** Final URL (wa.me/whatsapp://) to open after confirmation. */
  whatsappUrl: string | null;
}

const openExternal = (url: string) => {
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    window.location.href = url;
  }
};

export function WhatsAppUnlockDialog({
  open,
  onOpenChange,
  providerId,
  providerName,
  whatsappUrl,
}: Props) {
  const quotaQuery = useWhatsappQuota(open);
  const register = useRegisterWhatsappClick();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      register.reset();
    }
  }, [open]);

  const quota = quotaQuery.data;
  const loading = quotaQuery.isLoading;
  const remaining = quota?.remaining_today ?? 0;
  const limit = quota?.daily_limit ?? 3;
  const noQuota = !loading && remaining <= 0;

  const handleConfirm = async () => {
    if (!providerId || !whatsappUrl) return;
    setError(null);
    try {
      const result = await register.mutateAsync({ providerId });
      onOpenChange(false);
      // small delay to let dialog close before opening external
      setTimeout(() => openExternal(whatsappUrl), 80);
      if (result.reused) {
        toast({
          title: 'Contato ja desbloqueado hoje',
          description: 'Este prestador nao consumiu nova cota.',
        });
      } else {
        toast({
          title: 'Contato liberado',
          description: `Voce ainda pode ver ${result.remaining_today} contato(s) hoje.`,
        });
      }
    } catch (err) {
      if (err instanceof WhatsappQuotaExceededError) {
        setError(err.message);
        // refetch to sync UI
        quotaQuery.refetch();
      } else {
        setError((err as Error)?.message ?? 'Nao foi possivel liberar o contato.');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />
            Liberar contato no WhatsApp
          </DialogTitle>
          <DialogDescription>
            Para garantir a qualidade do atendimento, voce pode acessar ate {limit} contatos por dia.
            {providerName ? ` Voce esta prestes a falar com ${providerName}.` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {loading ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : noQuota ? (
            <div
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-medium">Limite diario atingido</p>
                <p>
                  Voce ja desbloqueou {limit} contatos hoje. Volte amanha ou consulte a aba
                  &quot;Meus Contatos&quot; no painel.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
              <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="space-y-1">
                <p>
                  <strong>Voce ainda pode ver {remaining} contato(s) hoje.</strong>
                </p>
                <p className="text-muted-foreground">
                  Se clicar no mesmo prestador novamente hoje, nao consome nova cota.
                </p>
              </div>
            </div>
          )}

          {error && !noQuota && (
            <div
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive"
              role="alert"
            >
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Negociacao direta entre voce e o prestador. Sem intermediario.</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            asChild
            className="gap-1"
          >
            <Link to="/dashboard/cliente/contatos" onClick={() => onOpenChange(false)}>
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              Meus Contatos
            </Link>
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || noQuota || register.isPending || !providerId || !whatsappUrl}
            className="gap-1"
          >
            {register.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Liberando...
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Confirmar e ver WhatsApp
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WhatsAppUnlockDialog;

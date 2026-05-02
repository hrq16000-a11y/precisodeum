/**
 * ReportWizardErrorButton — botão "Reportar erro" com formulário curto opcional.
 *
 * Ao clicar, abre um diálogo nativo com:
 *  - Descrição rápida (opcional)
 *  - Categoria/Cidade/Etapa/Navegador pré-preenchidos via `contextSnapshot`
 *  - Envio para `error_reports` via `reportError`
 *
 * O ID do relatório é copiado para o clipboard e exibido em toast para o
 * suporte conseguir reproduzir/priorizar.
 */
import { useState } from 'react';
import { LifeBuoy, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { reportError, getActionHistory, trackAction } from '@/lib/errorReporter';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  step: string;
  componentName?: string;
  label?: string;
  variant?: 'ghost' | 'outline' | 'secondary';
  /** Contexto adicional (categoria, cidade, código do erro) anexado no relatório. */
  contextSnapshot?: Record<string, unknown>;
}

export const ReportWizardErrorButton = ({
  step,
  componentName = 'ServiceWizard',
  label = 'Reportar erro',
  variant = 'ghost',
  contextSnapshot,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    trackAction('user_report_open', step);

    let lastEvents: Array<{ phase: string; event: string; created_at: string }> = [];
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('onboarding_events')
          .select('phase, event, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        lastEvents = (data || []) as any;
      }
    } catch { /* ignore */ }

    const payload = {
      step,
      note: note.trim() || null,
      contextSnapshot: contextSnapshot || null,
      browser: typeof navigator !== 'undefined' ? {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: (navigator as any).platform || null,
      } : null,
      page: typeof window !== 'undefined' ? window.location.pathname + window.location.search : null,
      actionHistory: getActionHistory().slice(-10),
      lastFunnelEvents: lastEvents,
    };

    const id = await reportError({
      errorMessage: `[USER REPORT] ${step}${note.trim() ? ` — ${note.trim().slice(0, 120)}` : ''}`,
      componentName,
      actionContext: `wizard:${step}:user_report`,
      severity: 'warning',
      errorStack: JSON.stringify(payload, null, 2),
    });

    setSending(false);
    if (id) {
      const short = id.slice(0, 8);
      setDone(short);
      try { await navigator.clipboard.writeText(short); } catch { /* ignore */ }
      toast.success('Relatório enviado', {
        description: `Código: ${short} (copiado). Envie ao suporte se persistir.`,
        duration: 8000,
      });
      setOpen(false);
      setNote('');
    } else {
      toast.error('Não foi possível enviar o relatório agora.');
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        onClick={() => setOpen(true)}
        disabled={sending}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {sending ? (
          <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Enviando…</>
        ) : done ? (
          <><CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" /> Enviado ({done})</>
        ) : (
          <><LifeBuoy className="mr-1 h-3 w-3" /> {label}</>
        )}
      </Button>

      <Dialog open={open} onOpenChange={(v) => !sending && setOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reportar para o suporte</DialogTitle>
            <DialogDescription className="text-xs">
              Vamos anexar automaticamente etapa, navegador e seu contexto recente.
              Você pode descrever rapidamente o que aconteceu (opcional).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <Label htmlFor="report-note" className="text-xs text-muted-foreground">
              O que aconteceu? (opcional)
            </Label>
            <Textarea
              id="report-note"
              data-testid="report-dialog-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              placeholder="Ex.: cliquei em continuar e a tela ficou vazia"
              rows={3}
            />

            <div className="rounded-md border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
              <p className="font-medium text-foreground">Contexto que será enviado</p>
              <ul className="mt-1 space-y-0.5">
                <li>Etapa: <code className="font-mono">{step}</code></li>
                {contextSnapshot && Object.entries(contextSnapshot).slice(0, 6).map(([k, v]) => (
                  <li key={k}>
                    {k}: <code className="font-mono break-all">
                      {Array.isArray(v) ? (v.length ? v.join(', ') : '—') : String(v ?? '—')}
                    </code>
                  </li>
                ))}
                <li>Navegador: {typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 60) + '…' : '—'}</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={sending}>
              Cancelar
            </Button>
            <Button onClick={handleSend} disabled={sending} data-testid="report-dialog-send">
              {sending ? (<><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Enviando…</>) : 'Enviar relatório'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReportWizardErrorButton;

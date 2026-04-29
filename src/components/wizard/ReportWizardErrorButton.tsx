/**
 * ReportWizardErrorButton — Botão "Reportar erro" que pré-preenche um relatório
 * com user_id, etapa atual e últimos eventos do funil.
 *
 * Salva em `error_reports` (via reportError) e copia o ID para o clipboard
 * para o usuário enviar ao suporte.
 */
import { useState } from 'react';
import { LifeBuoy, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportError, getActionHistory, trackAction } from '@/lib/errorReporter';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  step: string;
  componentName?: string;
  /** Texto opcional para exibir no botão (default: "Reportar erro") */
  label?: string;
  /** Variante visual */
  variant?: 'ghost' | 'outline' | 'secondary';
}

export const ReportWizardErrorButton = ({
  step, componentName = 'ServiceWizard', label = 'Reportar erro', variant = 'ghost',
}: Props) => {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const handleClick = async () => {
    if (sending || done) return;
    setSending(true);
    trackAction('user_report_open', step);

    // Coleta últimos eventos do funil
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
    } catch {/* ignore */}

    const id = await reportError({
      errorMessage: `[USER REPORT] travou na etapa "${step}"`,
      componentName,
      actionContext: `wizard:${step}:user_report`,
      severity: 'warning',
      errorStack: JSON.stringify({
        step,
        actionHistory: getActionHistory().slice(-10),
        lastFunnelEvents: lastEvents,
      }, null, 2),
    });

    setSending(false);
    if (id) {
      const short = id.slice(0, 8);
      setDone(short);
      try { await navigator.clipboard.writeText(short); } catch {/* ignore */}
      toast.success('Relatório enviado', {
        description: `Código: ${short} (copiado). Envie ao suporte se persistir.`,
        duration: 8000,
      });
    } else {
      toast.error('Não foi possível enviar o relatório agora.');
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={handleClick}
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
  );
};

export default ReportWizardErrorButton;

import { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCcw, Trash2 } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSeoHead } from '@/hooks/useSeoHead';
import { useAdmin } from '@/hooks/useAdmin';
import {
  clearWizardResetDebugLog,
  readWizardResetDebugLog,
  type WizardDebugEntry,
} from '@/lib/wizardResetDebug';

const fmt = (value: string) => {
  try {
    return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return value;
  }
};

export default function AdminWizardDiagnosticsPage() {
  useSeoHead({ title: 'Diagnóstico do Wizard', description: 'Auditoria dos gates e resets do Wizard', noindex: true });
  const { loading } = useAdmin();
  const [version, setVersion] = useState(0);

  const entries = useMemo(() => readWizardResetDebugLog(), [version]);

  const refresh = () => setVersion((v) => v + 1);
  const clear = () => {
    clearWizardResetDebugLog();
    refresh();
  };

  if (loading) {
    return <AdminLayout><p className="text-sm text-muted-foreground">Carregando diagnóstico...</p></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-foreground">Diagnóstico do Wizard</h1>
          <p className="text-sm text-muted-foreground">
            Mostra qual rota, gate ou hidratação empurrou o usuário para trás ou mudou a fase do cadastro.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh} className="gap-2">
            <RefreshCcw className="h-4 w-4" /> Atualizar
          </Button>
          <Button variant="destructive" onClick={clear} className="gap-2">
            <Trash2 className="h-4 w-4" /> Limpar logs
          </Button>
        </div>
      </div>

      <Card className="p-4 mb-4 bg-muted/30 border-border">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-accent/10 p-2 text-accent">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">O que observar</p>
            <ul className="list-disc pl-4 text-muted-foreground space-y-1">
              <li><strong>onboarding-gate-redirect</strong>: o gate global mandou o usuário para outra rota.</li>
              <li><strong>bet-celebration-cta</strong>: clique no botão de criar o primeiro serviço no V3.</li>
              <li><strong>onboarding-v2-bootstrap</strong>: reaproveitamento de dados do perfil/provider.</li>
              <li><strong>onboarding-v2-phase-regression-blocked</strong>: tentativa de voltar para etapa antiga foi bloqueada.</li>
            </ul>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {entries.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Nenhum evento registrado ainda. Reproduza o problema e volte aqui.
          </Card>
        ) : entries.map((entry: WizardDebugEntry, index) => (
          <Card key={`${entry.at}-${index}`} className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{entry.source}</Badge>
              <Badge variant="outline">{entry.reason}</Badge>
              <span className="text-xs text-muted-foreground">{fmt(entry.at)}</span>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Rota atual</p>
                <p className="font-medium text-foreground break-all">{entry.route || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Próxima rota</p>
                <p className="font-medium text-foreground break-all">{entry.nextRoute || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fase</p>
                <p className="font-medium text-foreground">{entry.phase || '—'}</p>
              </div>
            </div>

            {entry.meta && Object.keys(entry.meta).length > 0 && (
              <pre className="overflow-auto rounded-md border border-border bg-background p-3 text-[11px] text-muted-foreground">
                {JSON.stringify(entry.meta, null, 2)}
              </pre>
            )}
          </Card>
        ))}
      </div>
    </AdminLayout>
  );
}

/**
 * ReportWizardErrorButton — botão "Reportar erro" com formulário curto opcional.
 *
 * Ao clicar, abre um diálogo nativo com:
 *  - Descrição rápida (opcional)
 *  - Captura de tela anexada (opcional, até 3 imagens, 5 MB cada)
 *  - Categoria/Cidade/Etapa/Navegador pré-preenchidos via `contextSnapshot`
 *  - Envio para `error_reports` via `reportError`
 *
 * Anexos: imagens vão para o bucket privado `error-attachments` na pasta
 * `{user_id}/{reportId}/...`. As URLs (signed paths) ficam no payload do
 * relatório para o suporte abrir.
 *
 * O ID do relatório é copiado para o clipboard e exibido em toast.
 */
import { useRef, useState } from 'react';
import { LifeBuoy, Loader2, CheckCircle2, ImagePlus, X } from 'lucide-react';
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

const MAX_FILES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

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
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAddFiles = (list: FileList | null) => {
    if (!list) return;
    const next: File[] = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        toast.error(`Máximo de ${MAX_FILES} imagens.`);
        break;
      }
      if (!f.type.startsWith('image/')) {
        toast.error(`"${f.name}" não é uma imagem.`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`"${f.name}" excede 5 MB.`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadAttachments = async (
    userId: string,
    reportId: string,
  ): Promise<string[]> => {
    if (!files.length) return [];
    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = (f.name.split('.').pop() || 'png').toLowerCase().slice(0, 5);
      const path = `${userId}/${reportId}/screenshot-${Date.now()}-${i}.${ext}`;
      try {
        const { error } = await supabase.storage
          .from('error-attachments')
          .upload(path, f, { contentType: f.type, upsert: false });
        if (!error) paths.push(path);
      } catch { /* ignore individual upload failure */ }
    }
    return paths;
  };

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    trackAction('user_report_open', step);

    let userId: string | null = null;
    let lastEvents: Array<{ phase: string; event: string; created_at: string }> = [];
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
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
      attachments: [] as string[],
    };

    const id = await reportError({
      errorMessage: `[USER REPORT] ${step}${note.trim() ? ` — ${note.trim().slice(0, 120)}` : ''}`,
      componentName,
      actionContext: `wizard:${step}:user_report`,
      severity: 'warning',
      errorStack: JSON.stringify(payload, null, 2),
    });

    if (id && userId && files.length > 0) {
      const paths = await uploadAttachments(userId, id);
      if (paths.length) {
        // Atualiza o relatório com as paths para o suporte abrir.
        try {
          await supabase
            .from('error_reports' as any)
            .update({
              error_stack: JSON.stringify(
                { ...payload, attachments: paths },
                null,
                2,
              ),
            } as any)
            .eq('id', id);
        } catch { /* ignore */ }
      }
    }

    setSending(false);
    if (id) {
      const short = id.slice(0, 8);
      setDone(short);
      try { await navigator.clipboard.writeText(short); } catch { /* ignore */ }
      toast.success('Relatório enviado', {
        description: `Código: ${short} (copiado).${files.length ? ` ${files.length} anexo(s).` : ''}`,
        duration: 8000,
      });
      setOpen(false);
      setNote('');
      setFiles([]);
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
              Você pode descrever rapidamente o que aconteceu (opcional) e anexar
              uma captura de tela.
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

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Capturas de tela (opcional, até {MAX_FILES})
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                multiple
                data-testid="report-dialog-screenshot-input"
                className="hidden"
                onChange={(e) => handleAddFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={files.length >= MAX_FILES}
                data-testid="report-dialog-attach-btn"
                className="h-8 gap-1 text-xs"
              >
                <ImagePlus className="h-3 w-3" />
                Anexar imagem
              </Button>
              {files.length > 0 && (
                <ul
                  data-testid="report-dialog-attachments"
                  className="mt-1 grid grid-cols-3 gap-1.5 text-[11px] text-muted-foreground"
                >
                  {files.map((f, i) => {
                    const url = URL.createObjectURL(f);
                    return (
                      <li
                        key={`${f.name}-${i}`}
                        className="relative overflow-hidden rounded border border-border bg-muted/30"
                      >
                        <img
                          src={url}
                          alt={f.name}
                          className="aspect-square w-full object-cover"
                          onLoad={() => URL.revokeObjectURL(url)}
                        />
                        <span className="block truncate px-1 py-0.5 text-[10px]">
                          {(f.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          aria-label={`Remover ${f.name}`}
                          className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

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

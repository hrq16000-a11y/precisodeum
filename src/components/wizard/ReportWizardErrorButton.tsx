/**
 * ReportWizardErrorButton — botão "Reportar erro" com formulário curto opcional.
 *
 * Fluxo do diálogo:
 *  1. Usuário descreve (opcional) e anexa até 3 imagens.
 *     - Contador "x/3" sempre visível.
 *     - Validação de tipo/tamanho roda ao escolher arquivos; o botão Enviar
 *       fica desabilitado enquanto há validação em andamento.
 *  2. Ao enviar, criamos o relatório em `error_reports` com payload
 *     padronizado (categoria, cidade, etapa, navegador e `code`).
 *  3. Após sucesso, mostramos uma etapa "recebido" no próprio diálogo com:
 *      - Número do ticket (8 caracteres do UUID)
 *      - Botão para reenviar anexos caso o upload tenha falhado.
 *
 * Anexos: imagens vão para o bucket privado `error-attachments` na pasta
 * `{user_id}/{reportId}/...`. As paths ficam no payload do relatório.
 *
 * Códigos canônicos: `support_report:open|sent|failed|attachment_failed`
 * (ver `wizardErrorCodes.ts`).
 */
import { useEffect, useRef, useState } from 'react';
import { LifeBuoy, Loader2, CheckCircle2, ImagePlus, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { reportError, getActionHistory, trackAction } from '@/lib/errorReporter';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { WIZARD_ERROR_CODES } from '@/lib/wizardErrorCodes';
import { parseDeviceInfo, deviceSummary } from '@/lib/deviceInfo';

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

interface Attachment {
  file: File;
  /** URL local de pré-visualização (createObjectURL). */
  preview: string;
  /** Status de validação assíncrona (dimensões/extensão). */
  status: 'validating' | 'ready' | 'invalid';
  reason?: string;
}

async function validateImage(file: File): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({ ok: false, reason: 'tipo inválido' });
      return;
    }
    if (file.size > MAX_BYTES) {
      resolve({ ok: false, reason: 'maior que 5 MB' });
      return;
    }
    // Carrega a imagem para garantir que ela é decodificável (não é, ex.,
    // um PDF renomeado ou um arquivo corrompido).
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve({ ok: true }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ ok: false, reason: 'imagem corrompida' }); };
    img.src = url;
  });
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
  const [note, setNote] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Etapa "recebido": após sucesso, em vez de fechar o diálogo, mostramos
  // o ticket. Permite reenviar anexos caso o upload tenha falhado.
  const [receipt, setReceipt] = useState<{
    reportId: string;
    ticket: string;
    userId: string | null;
    uploadedPaths: string[];
    attachmentError: boolean;
  } | null>(null);
  const [reuploading, setReuploading] = useState(false);

  // Limpa preview URLs ao desmontar para não vazar memória.
  useEffect(() => () => {
    attachments.forEach((a) => { try { URL.revokeObjectURL(a.preview); } catch { /* noop */ } });
  }, [attachments]);

  useEffect(() => {
    if (open) {
      void supabase.auth.getUser().then(({ data }) => {
        // marca abertura para telemetria (best-effort)
        trackAction(WIZARD_ERROR_CODES.SUPPORT_REPORT_OPEN, step);
        return data;
      });
    }
  }, [open, step]);

  const validatingCount = attachments.filter((a) => a.status === 'validating').length;
  const validCount = attachments.filter((a) => a.status === 'ready').length;
  const canSend = !sending && validatingCount === 0;

  const handleAddFiles = async (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list);
    const room = MAX_FILES - attachments.length;
    if (room <= 0) {
      toast.error(`Máximo de ${MAX_FILES} imagens.`);
      return;
    }
    const taken = files.slice(0, room);
    if (files.length > room) {
      toast.message(`Apenas ${room} arquivo(s) adicionado(s).`, {
        description: `Limite total: ${MAX_FILES} imagens.`,
      });
    }
    const provisional: Attachment[] = taken.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: 'validating',
    }));
    setAttachments((prev) => [...prev, ...provisional]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Valida cada arquivo de forma independente — o botão Enviar fica
    // desabilitado enquanto algum estiver "validating".
    for (const att of provisional) {
      const res = await validateImage(att.file);
      setAttachments((prev) =>
        prev.map((a) =>
          a === att
            ? { ...a, status: res.ok ? 'ready' : 'invalid', reason: res.reason }
            : a,
        ),
      );
      if (!res.ok) {
        toast.error(`"${att.file.name}" inválido`, {
          description: res.reason || 'Não foi possível validar a imagem.',
        });
      }
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => {
      const next = [...prev];
      const removed = next.splice(idx, 1)[0];
      if (removed) { try { URL.revokeObjectURL(removed.preview); } catch { /* noop */ } }
      return next;
    });
  };

  const uploadAttachments = async (
    userId: string,
    reportId: string,
    files: File[],
  ): Promise<{ paths: string[]; failed: number }> => {
    if (!files.length) return { paths: [], failed: 0 };
    const paths: string[] = [];
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = (f.name.split('.').pop() || 'png').toLowerCase().slice(0, 5);
      const path = `${userId}/${reportId}/screenshot-${Date.now()}-${i}.${ext}`;
      try {
        const { error } = await supabase.storage
          .from('error-attachments')
          .upload(path, f, { contentType: f.type, upsert: false });
        if (error) { failed++; continue; }
        paths.push(path);
      } catch {
        failed++;
      }
    }
    return { paths, failed };
  };

  const buildPayload = (uploadedPaths: string[]) => ({
    code: (contextSnapshot && (contextSnapshot as any).code) || step,
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
    attachments: uploadedPaths,
  });

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    trackAction('user_report_send', step);

    let userId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch { /* ignore */ }

    const validFiles = attachments.filter((a) => a.status === 'ready').map((a) => a.file);
    const initialPayload = buildPayload([]);

    const id = await reportError({
      errorMessage: `[USER REPORT] ${step}${note.trim() ? ` — ${note.trim().slice(0, 120)}` : ''}`,
      componentName,
      actionContext: `wizard:${step}:user_report`,
      severity: 'warning',
      errorStack: JSON.stringify(initialPayload, null, 2),
    });

    if (!id) {
      setSending(false);
      trackAction(WIZARD_ERROR_CODES.SUPPORT_REPORT_FAILED, step);
      toast.error('Não foi possível enviar o relatório agora.');
      return;
    }

    let uploadedPaths: string[] = [];
    let failed = 0;
    if (userId && validFiles.length > 0) {
      const result = await uploadAttachments(userId, id, validFiles);
      uploadedPaths = result.paths;
      failed = result.failed;
      if (uploadedPaths.length) {
        try {
          await supabase
            .from('error_reports' as any)
            .update({
              error_stack: JSON.stringify(buildPayload(uploadedPaths), null, 2),
            } as any)
            .eq('id', id);
        } catch { /* ignore */ }
      }
      if (failed > 0) trackAction(WIZARD_ERROR_CODES.SUPPORT_REPORT_ATTACHMENT_FAILED, `${step}:${failed}`);
    }

    trackAction(WIZARD_ERROR_CODES.SUPPORT_REPORT_SENT, step);
    const ticket = id.slice(0, 8);
    try { await navigator.clipboard.writeText(ticket); } catch { /* ignore */ }
    setReceipt({
      reportId: id,
      ticket,
      userId,
      uploadedPaths,
      attachmentError: failed > 0,
    });
    setSending(false);
  };

  const handleReuploadAttachments = async () => {
    if (!receipt || !receipt.userId) return;
    const validFiles = attachments.filter((a) => a.status === 'ready').map((a) => a.file);
    if (!validFiles.length) return;
    setReuploading(true);
    const { paths, failed } = await uploadAttachments(receipt.userId, receipt.reportId, validFiles);
    if (paths.length) {
      try {
        await supabase
          .from('error_reports' as any)
          .update({
            error_stack: JSON.stringify(
              buildPayload([...receipt.uploadedPaths, ...paths]),
              null,
              2,
            ),
          } as any)
          .eq('id', receipt.reportId);
      } catch { /* ignore */ }
    }
    setReceipt({
      ...receipt,
      uploadedPaths: [...receipt.uploadedPaths, ...paths],
      attachmentError: failed > 0,
    });
    setReuploading(false);
    if (failed === 0) toast.success('Anexos reenviados com sucesso.');
    else toast.error(`${failed} anexo(s) ainda falharam.`);
  };

  const handleClose = () => {
    if (sending) return;
    setOpen(false);
    // Limpa o estado para a próxima abertura.
    setNote('');
    attachments.forEach((a) => { try { URL.revokeObjectURL(a.preview); } catch { /* noop */ } });
    setAttachments([]);
    setReceipt(null);
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
        ) : receipt ? (
          <><CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" /> Enviado ({receipt.ticket})</>
        ) : (
          <><LifeBuoy className="mr-1 h-3 w-3" /> {label}</>
        )}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
        <DialogContent className="max-w-sm">
          {!receipt ? (
            <>
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
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      Capturas de tela (opcional)
                    </Label>
                    <span
                      data-testid="report-dialog-attach-counter"
                      className="text-[11px] tabular-nums text-muted-foreground"
                    >
                      {attachments.length}/{MAX_FILES}
                      {validatingCount > 0 && ` • validando ${validatingCount}…`}
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT}
                    multiple
                    data-testid="report-dialog-screenshot-input"
                    className="hidden"
                    onChange={(e) => { void handleAddFiles(e.target.files); }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={attachments.length >= MAX_FILES}
                    data-testid="report-dialog-attach-btn"
                    className="h-8 gap-1 text-xs"
                  >
                    <ImagePlus className="h-3 w-3" />
                    Anexar imagem
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    PNG, JPG, WEBP ou GIF · até 5 MB cada
                  </p>
                  {attachments.length > 0 && (
                    <ul
                      data-testid="report-dialog-attachments"
                      className="mt-1 grid grid-cols-3 gap-1.5 text-[11px] text-muted-foreground"
                    >
                      {attachments.map((a, i) => (
                        <li
                          key={`${a.file.name}-${i}`}
                          data-status={a.status}
                          className={
                            'relative overflow-hidden rounded border bg-muted/30 ' +
                            (a.status === 'invalid'
                              ? 'border-rose-400/70'
                              : a.status === 'validating'
                                ? 'border-amber-300/60 opacity-70'
                                : 'border-border')
                          }
                        >
                          <img
                            src={a.preview}
                            alt={a.file.name}
                            className="aspect-square w-full object-cover"
                          />
                          <span className="block truncate px-1 py-0.5 text-[10px]">
                            {a.status === 'validating' ? 'validando…'
                              : a.status === 'invalid' ? (a.reason || 'inválido')
                              : `${(a.file.size / 1024).toFixed(0)} KB`}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(i)}
                            aria-label={`Remover ${a.file.name}`}
                            className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
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
                <Button variant="ghost" onClick={handleClose} disabled={sending}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={!canSend}
                  data-testid="report-dialog-send"
                  title={validatingCount > 0 ? 'Aguarde a validação dos anexos…' : undefined}
                >
                  {sending ? (
                    <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Enviando…</>
                  ) : validatingCount > 0 ? (
                    <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Validando…</>
                  ) : (
                    <>Enviar relatório{validCount > 0 ? ` (${validCount})` : ''}</>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            // Etapa "recebido"
            <div data-testid="report-dialog-receipt" className="space-y-3 py-1">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Relatório recebido
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Obrigado! Nossa equipe já recebeu seu relatório com o contexto da etapa
                  e do navegador. Guarde o número do ticket abaixo se precisar nos contatar.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-md border border-emerald-300/60 bg-emerald-50/70 p-3 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <p className="text-xs text-muted-foreground">Número do ticket</p>
                <p
                  data-testid="report-dialog-ticket"
                  className="mt-0.5 font-mono text-base font-bold tracking-wider text-emerald-900 dark:text-emerald-100"
                >
                  #{receipt.ticket}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Copiado para a área de transferência.
                </p>
              </div>

              {attachments.length > 0 && (
                <div
                  data-testid="report-dialog-attachments-summary"
                  className={
                    'rounded-md border p-2 text-xs ' +
                    (receipt.attachmentError
                      ? 'border-rose-400/60 bg-rose-50/70 text-rose-900 dark:bg-rose-500/10 dark:text-rose-100'
                      : 'border-border bg-muted/40 text-muted-foreground')
                  }
                >
                  {receipt.attachmentError ? (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Alguns anexos falharam ao subir.
                      </p>
                      <p className="text-[11px]">
                        {receipt.uploadedPaths.length} de {attachments.filter((a) => a.status === 'ready').length} enviados.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        disabled={reuploading}
                        onClick={() => { void handleReuploadAttachments(); }}
                        data-testid="report-dialog-reupload"
                      >
                        {reuploading ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Reenviando…</>
                        ) : (
                          <><RefreshCw className="h-3 w-3" /> Reenviar anexos</>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <p>{receipt.uploadedPaths.length} anexo(s) enviado(s).</p>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button onClick={handleClose} data-testid="report-dialog-close">
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReportWizardErrorButton;

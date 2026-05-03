/**
 * ReportWizardErrorButton — botão "Reportar erro" com formulário curto opcional.
 *
 * Fluxo:
 *  1. Usuário descreve (opcional) e anexa até 3 imagens (validação async).
 *  2. Ao enviar, criamos `error_reports` com payload padronizado contendo o
 *     `code` canônico do wizard (ex.: phase2_photos:no_session).
 *  3. Após sucesso, mostramos a etapa "recebido" com:
 *      - O **code canônico** + ticket (8 chars do UUID).
 *      - Lista detalhada de anexos com status (enviado/falhou) e botão de
 *        reenviar **apenas os que falharam**.
 *  4. O receipt fica persistido em `localStorage` (`wizard_support_receipt:{code}`)
 *     para que recarregar a página mostre o mesmo ticket sem reenviar.
 */
import { useEffect, useRef, useState } from 'react';
import { LifeBuoy, Loader2, CheckCircle2, ImagePlus, X, RefreshCw, AlertTriangle, XCircle } from 'lucide-react';
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

type UploadStatus = 'pending' | 'uploaded' | 'failed';

interface Attachment {
  file: File;
  preview: string;
  status: 'validating' | 'ready' | 'invalid';
  reason?: string;
  /** Status de upload, atualizado após Enviar. */
  upload: UploadStatus;
  /** Path no bucket após upload bem-sucedido. */
  path?: string;
  /** Mensagem do erro de upload (se falhou). */
  uploadError?: string;
}

interface PersistedReceipt {
  reportId: string;
  ticket: string;
  code: string;
  step: string;
  at: number;
  uploadedPaths: string[];
}

const RECEIPT_STORAGE_PREFIX = 'wizard_support_receipt:';
const RECEIPT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

const receiptKey = (code: string) => `${RECEIPT_STORAGE_PREFIX}${code}`;

function readPersistedReceipt(code: string): PersistedReceipt | null {
  try {
    const raw = localStorage.getItem(receiptKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedReceipt;
    if (!parsed?.reportId || !parsed?.ticket) return null;
    if (Date.now() - (parsed.at || 0) > RECEIPT_TTL_MS) {
      localStorage.removeItem(receiptKey(code));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePersistedReceipt(receipt: PersistedReceipt) {
  try { localStorage.setItem(receiptKey(receipt.code), JSON.stringify(receipt)); } catch { /* noop */ }
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
  // O code canônico vem do contextSnapshot (preferido) ou cai no `step`.
  const canonicalCode =
    (contextSnapshot && typeof (contextSnapshot as any).code === 'string' && (contextSnapshot as any).code) || step;

  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [receipt, setReceipt] = useState<{
    reportId: string;
    ticket: string;
    userId: string | null;
    attachmentError: boolean;
  } | null>(null);
  const [reuploading, setReuploading] = useState(false);

  // Hidrata do localStorage no mount — se já reportou, mostra o ticket.
  useEffect(() => {
    const persisted = readPersistedReceipt(canonicalCode);
    if (persisted) {
      setReceipt({
        reportId: persisted.reportId,
        ticket: persisted.ticket,
        userId: null,
        attachmentError: false,
      });
    }
  }, [canonicalCode]);

  useEffect(() => () => {
    attachments.forEach((a) => { try { URL.revokeObjectURL(a.preview); } catch { /* noop */ } });
  }, [attachments]);

  useEffect(() => {
    if (open) {
      void supabase.auth.getUser().then(({ data }) => {
        trackAction(WIZARD_ERROR_CODES.SUPPORT_REPORT_OPEN, step);
        return data;
      });
    }
  }, [open, step]);

  const validatingCount = attachments.filter((a) => a.status === 'validating').length;
  const validCount = attachments.filter((a) => a.status === 'ready').length;
  const failedCount = attachments.filter((a) => a.upload === 'failed').length;
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
      upload: 'pending',
    }));
    setAttachments((prev) => [...prev, ...provisional]);
    if (fileInputRef.current) fileInputRef.current.value = '';

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

  /** Faz upload de uma seleção de attachments e atualiza o estado por arquivo. */
  const uploadSelected = async (
    userId: string,
    reportId: string,
    targets: Attachment[],
  ): Promise<{ paths: string[]; failed: number }> => {
    if (!targets.length) return { paths: [], failed: 0 };
    const paths: string[] = [];
    let failed = 0;
    for (let i = 0; i < targets.length; i++) {
      const att = targets[i];
      const ext = (att.file.name.split('.').pop() || 'png').toLowerCase().slice(0, 5);
      const path = `${userId}/${reportId}/screenshot-${Date.now()}-${i}.${ext}`;
      try {
        const { error } = await supabase.storage
          .from('error-attachments')
          .upload(path, att.file, { contentType: att.file.type, upsert: false });
        if (error) {
          failed++;
          setAttachments((prev) =>
            prev.map((a) => (a === att ? { ...a, upload: 'failed', uploadError: error.message } : a)),
          );
          continue;
        }
        paths.push(path);
        setAttachments((prev) =>
          prev.map((a) => (a === att ? { ...a, upload: 'uploaded', path } : a)),
        );
      } catch (err: any) {
        failed++;
        setAttachments((prev) =>
          prev.map((a) => (a === att ? { ...a, upload: 'failed', uploadError: String(err?.message || err) } : a)),
        );
      }
    }
    return { paths, failed };
  };

  const buildPayload = (uploadedPaths: string[]) => {
    const device = typeof navigator !== 'undefined' ? parseDeviceInfo() : null;
    const snapshot = contextSnapshot || null;
    const lastPersistError = snapshot && typeof snapshot === 'object' && 'lastPersistError' in snapshot
      ? (snapshot as any).lastPersistError
      : {
          message: snapshot && typeof (snapshot as any).tech_message === 'string' ? (snapshot as any).tech_message : null,
          code: snapshot && typeof (snapshot as any).tech_code === 'string' ? (snapshot as any).tech_code : null,
        };
    return {
      code: canonicalCode,
      step,
      note: note.trim() || null,
       contextSnapshot: snapshot,
       category: snapshot && typeof (snapshot as any).category === 'string' ? (snapshot as any).category : null,
       city: snapshot && typeof (snapshot as any).city === 'string' ? (snapshot as any).city : null,
       lastPersistError,
      browser: device ? {
        userAgent: device.userAgent,
        language: typeof navigator !== 'undefined' ? navigator.language : null,
        platform: (typeof navigator !== 'undefined' ? (navigator as any).platform : null) || null,
        os: device.os,
        osVersion: device.osVersion,
        model: device.model,
        name: device.browser,
        version: device.browserVersion,
        isMobile: device.isMobile,
      } : null,
       device: device ? {
         model: device.model,
         os: device.os,
         browser: device.browser,
       } : null,
      page: typeof window !== 'undefined' ? window.location.pathname + window.location.search : null,
      actionHistory: getActionHistory().slice(-10),
      attachments: uploadedPaths,
    };
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    trackAction('user_report_send', step);

    let userId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch { /* ignore */ }

    const validAttachments = attachments.filter((a) => a.status === 'ready');
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
    if (userId && validAttachments.length > 0) {
      const result = await uploadSelected(userId, id, validAttachments);
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
    writePersistedReceipt({
      reportId: id,
      ticket,
      code: canonicalCode,
      step,
      at: Date.now(),
      uploadedPaths,
    });
    setReceipt({
      reportId: id,
      ticket,
      userId,
      attachmentError: failed > 0,
    });
    setSending(false);
  };

  /** Reenvia somente os anexos com upload === 'failed'. */
  const handleReuploadFailed = async () => {
    if (!receipt) return;
    let userId = receipt.userId;
    if (!userId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id ?? null;
      } catch { /* ignore */ }
    }
    if (!userId) {
      toast.error('Sessão expirada — entre novamente para reenviar anexos.');
      return;
    }
    const targets = attachments.filter((a) => a.upload === 'failed');
    if (!targets.length) return;
    setReuploading(true);
    const { paths, failed } = await uploadSelected(userId, receipt.reportId, targets);
    const allUploadedPaths = attachments.filter((a) => a.upload === 'uploaded').map((a) => a.path!).concat(paths);
    if (paths.length) {
      try {
        await supabase
          .from('error_reports' as any)
          .update({
            error_stack: JSON.stringify(buildPayload(allUploadedPaths), null, 2),
          } as any)
          .eq('id', receipt.reportId);
      } catch { /* ignore */ }
      // Atualiza receipt persistido com os novos paths
      const persisted = readPersistedReceipt(canonicalCode);
      if (persisted) {
        writePersistedReceipt({ ...persisted, uploadedPaths: allUploadedPaths });
      }
    }
    setReceipt({ ...receipt, userId, attachmentError: failed > 0 });
    setReuploading(false);
    if (failed === 0) toast.success('Anexos reenviados com sucesso.');
    else toast.error(`${failed} anexo(s) ainda falharam.`);
  };

  const handleClose = () => {
    if (sending) return;
    setOpen(false);
    setNote('');
    attachments.forEach((a) => { try { URL.revokeObjectURL(a.preview); } catch { /* noop */ } });
    setAttachments([]);
    // NOTA: não limpamos o `receipt` — ele permanece na sessão e em
    // localStorage (durante TTL) para que reabrir mostre o mesmo ticket.
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
                    <li>
                      Código: <code data-testid="report-dialog-code" className="font-mono">{canonicalCode}</code>
                    </li>
                    <li>Etapa: <code className="font-mono">{step}</code></li>
                    {contextSnapshot && Object.entries(contextSnapshot)
                      .filter(([k]) => k !== 'code')
                      .slice(0, 6)
                      .map(([k, v]) => (
                        <li key={k}>
                          {k}: <code className="font-mono break-all">
                            {Array.isArray(v) ? (v.length ? v.join(', ') : '—') : String(v ?? '—')}
                          </code>
                        </li>
                      ))}
                    <li>Dispositivo: <code className="font-mono break-all">{deviceSummary()}</code></li>
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
                  Código: <code data-testid="report-dialog-receipt-code" className="font-mono">{canonicalCode}</code>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Salvo neste navegador — se recarregar, o ticket continua aqui.
                </p>
              </div>

              {attachments.length > 0 && (
                <div
                  data-testid="report-dialog-attachments-summary"
                  className="rounded-md border border-border bg-muted/40 p-2 text-xs"
                >
                  <p className="mb-1 font-medium text-foreground">Anexos</p>
                  <ul data-testid="report-dialog-attachments-status" className="space-y-1">
                    {attachments.filter((a) => a.status === 'ready').map((a, i) => (
                      <li
                        key={`status-${i}`}
                        data-upload-status={a.upload}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="flex-1 truncate text-[11px]">{a.file.name}</span>
                        {a.upload === 'uploaded' && (
                          <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-medium">
                            <CheckCircle2 className="h-3 w-3" /> enviado
                          </span>
                        )}
                        {a.upload === 'failed' && (
                          <span className="flex items-center gap-1 text-rose-600 text-[10px] font-medium">
                            <XCircle className="h-3 w-3" /> falhou
                          </span>
                        )}
                        {a.upload === 'pending' && (
                          <span className="text-muted-foreground text-[10px]">aguardando</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {failedCount > 0 && (
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
                      <p className="flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-300">
                        <AlertTriangle className="h-3 w-3" />
                        {failedCount} anexo(s) falharam.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        disabled={reuploading}
                        onClick={() => { void handleReuploadFailed(); }}
                        data-testid="report-dialog-reupload"
                      >
                        {reuploading ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Reenviando…</>
                        ) : (
                          <><RefreshCw className="h-3 w-3" /> Reenviar falhos</>
                        )}
                      </Button>
                    </div>
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

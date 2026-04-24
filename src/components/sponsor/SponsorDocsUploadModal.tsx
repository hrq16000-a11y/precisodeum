import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, FileText, Image as ImageIcon, CheckCircle2, ShieldCheck, AlertCircle, X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onCompleted?: () => void;
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_DOC = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_BANNER = ['image/jpeg', 'image/png', 'image/webp'];

interface FileSlot {
  file: File | null;
  uploading: boolean;
  path: string | null;
  error: string | null;
}

const initialSlot: FileSlot = { file: null, uploading: false, path: null, error: null };

export function SponsorDocsUploadModal({ open, onOpenChange, leadId, onCompleted }: Props) {
  const [cnpjDoc, setCnpjDoc] = useState<FileSlot>(initialSlot);
  const [banner, setBanner] = useState<FileSlot>(initialSlot);
  const [checklist, setChecklist] = useState({
    dataConfirmed: false,
    contactConfirmed: false,
    contractAcknowledged: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleFile = async (
    file: File | undefined,
    kind: 'cnpj' | 'banner',
  ) => {
    if (!file) return;
    const allowed = kind === 'cnpj' ? ALLOWED_DOC : ALLOWED_BANNER;

    const logFailure = async (reason: string) => {
      try {
        await supabase.rpc('log_sponsor_doc_validation_failure' as any, {
          _lead_id: leadId,
          _doc_type: kind,
          _reason: reason,
          _metadata: { file_name: file.name, file_size: file.size, file_type: file.type },
        });
      } catch { /* ignore */ }
    };

    if (!allowed.includes(file.type)) {
      const reason = `Tipo não permitido (${file.type || 'desconhecido'}).`;
      toast.error(`${reason} Use ${kind === 'cnpj' ? 'PDF/JPG/PNG/WEBP' : 'JPG/PNG/WEBP'}.`);
      logFailure(reason);
      return;
    }
    if (file.size > MAX_SIZE) {
      const reason = `Arquivo acima de 10MB (${(file.size / (1024*1024)).toFixed(1)}MB).`;
      toast.error(reason);
      logFailure(reason);
      return;
    }

    const setter = kind === 'cnpj' ? setCnpjDoc : setBanner;
    setter({ file, uploading: true, path: null, error: null });

    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `leads/${leadId}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('sponsor_assets')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      setter({ file, uploading: false, path, error: null });
      toast.success(`${kind === 'cnpj' ? 'Documento' : 'Banner'} enviado.`);
    } catch (e: any) {
      setter({ file, uploading: false, path: null, error: e?.message || 'Falha no envio' });
      toast.error('Erro ao enviar arquivo. Tente novamente.');
    }
  };

  const checklistComplete =
    checklist.dataConfirmed && checklist.contactConfirmed && checklist.contractAcknowledged;
  const canFinish = checklistComplete && (cnpjDoc.path || banner.path);

  const handleFinish = async () => {
    if (!canFinish) return;
    setSubmitting(true);
    try {
      const updates: Record<string, any> = {
        checklist_confirmed: true,
        docs_submitted_at: new Date().toISOString(),
        additional_docs: [],
      };
      if (cnpjDoc.path) updates.cnpj_document_url = cnpjDoc.path;
      if (banner.path) updates.banner_url = banner.path;

      const { error } = await supabase
        .from('sponsor_leads' as any)
        .update(updates)
        .eq('id', leadId);
      if (error) throw error;

      toast.success('Documentos vinculados ao seu cadastro!');
      onCompleted?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível vincular os documentos.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            Anexar documentos e confirmar checklist
          </DialogTitle>
          <DialogDescription>
            Envie de forma segura o comprovante de CNPJ e/ou o banner do anúncio. Apenas administradores terão acesso aos arquivos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* CNPJ */}
          <div className="space-y-2 rounded-lg border border-border p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">Comprovante de CNPJ</Label>
            </div>
            <p className="text-xs text-muted-foreground">PDF ou imagem (até 10MB).</p>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => handleFile(e.target.files?.[0], 'cnpj')}
              disabled={cnpjDoc.uploading}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent hover:file:bg-accent/20"
            />
            {cnpjDoc.uploading && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Enviando...
              </p>
            )}
            {cnpjDoc.path && (
              <p className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> Enviado: {cnpjDoc.file?.name}
              </p>
            )}
          </div>

          {/* Banner */}
          <div className="space-y-2 rounded-lg border border-border p-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">Banner do anúncio (opcional)</Label>
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP (até 10MB).</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => handleFile(e.target.files?.[0], 'banner')}
              disabled={banner.uploading}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent hover:file:bg-accent/20"
            />
            {banner.uploading && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Enviando...
              </p>
            )}
            {banner.path && (
              <p className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> Enviado: {banner.file?.name}
              </p>
            )}
          </div>

          {/* Checklist */}
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <Label className="text-sm font-semibold">Checklist de confirmação</Label>
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={checklist.dataConfirmed}
                  onCheckedChange={(v) => setChecklist((c) => ({ ...c, dataConfirmed: !!v }))}
                />
                <span>Confirmo que os dados da empresa (CNPJ, razão social) estão corretos.</span>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={checklist.contactConfirmed}
                  onCheckedChange={(v) => setChecklist((c) => ({ ...c, contactConfirmed: !!v }))}
                />
                <span>O e-mail e telefone informados são de um responsável comercial autorizado.</span>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={checklist.contractAcknowledged}
                  onCheckedChange={(v) => setChecklist((c) => ({ ...c, contractAcknowledged: !!v }))}
                />
                <span>Reconheço que recebi/baixei o contrato e aguardo a análise da equipe.</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Fechar
          </Button>
          <Button onClick={handleFinish} disabled={!canFinish || submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Vinculando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" /> Concluir envio
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SponsorDocsUploadModal;

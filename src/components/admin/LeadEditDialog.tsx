import { useState, useEffect } from 'react';
import { Save, Loader2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';

const STATUS_OPTIONS = [
  { value: 'new', label: 'Novo' },
  { value: 'contacted', label: 'Contatado' },
  { value: 'converted', label: 'Convertido' },
  { value: 'closed', label: 'Fechado' },
];

interface LeadEditDialogProps {
  lead: any | null;
  onClose: () => void;
  onSaved: () => void;
}

const LeadEditDialog = ({ lead, onClose, onSaved }: LeadEditDialogProps) => {
  const [form, setForm] = useState({
    client_name: '',
    phone: '',
    client_email: '',
    service_needed: '',
    message: '',
    status: 'new',
    provider_id: '',
    internal_notes: '',
    lost_reason: '',
  });
  const [providers, setProviders] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  // Double-fetch: hidrata o registro completo por ID após abrir o dialog,
  // garantindo que campos como client_email / internal_notes / lost_reason
  // (fora do allowlist da listagem) apareçam para edição.
  const [fullLead, setFullLead] = useState<any | null>(null);
  const [hydrating, setHydrating] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!lead?.id) {
      setFullLead(null);
      setHistory([]);
      return;
    }
    let cancelled = false;
    setHydrating(true);
    (async () => {
      const [{ data: full }, { data: hist }] = await Promise.all([
        supabase.from('leads').select('*').eq('id', lead.id).maybeSingle(),
        supabase.from('lead_history' as any)
          .select('id, status_from, status_to, note, created_at')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      if (cancelled) return;
      setFullLead(full || null);
      setHistory((hist as any[]) || []);
      setHydrating(false);
    })();
    return () => { cancelled = true; };
  }, [lead?.id]);

  // Sempre que o registro completo chega, hidrata o form (fallback para os
  // campos da listagem). Nunca envia null como string; preserva o que veio.
  useEffect(() => {
    const src = fullLead || lead;
    if (!src) return;
    setForm({
      client_name: src.client_name ?? '',
      phone: src.phone ?? '',
      client_email: src.client_email ?? '',
      service_needed: src.service_needed ?? '',
      message: src.message ?? '',
      status: src.status ?? 'new',
      provider_id: src.provider_id ?? '',
      internal_notes: src.internal_notes ?? '',
      lost_reason: src.lost_reason ?? '',
    });
  }, [fullLead, lead]);

  useEffect(() => {
    supabase.from('providers').select('id, business_name').eq('status', 'approved').order('business_name')
      .then(({ data }) => setProviders(data || []));
  }, []);

  const handleSave = async () => {
    if (!lead) return;
    setSaving(true);

    // Resiliência PII: se o admin não tem acesso de leitura a campos sensíveis,
    // o double-fetch pode trazer null. Só enviamos no UPDATE os campos que o
    // usuário realmente preencheu, evitando "limpar" dados existentes no banco
    // só porque não conseguimos ler.
    const src = fullLead || lead || {};
    const payload: Record<string, any> = {
      client_name: form.client_name,
      phone: form.phone,
      service_needed: form.service_needed,
      message: form.message,
      status: form.status,
      provider_id: form.provider_id,
    };
    // Somente persiste campos sensíveis se conseguimos lê-los OU se o admin
    // digitou algo novo (não vazio). Se não tem acesso (null) e não digitou,
    // omite para não sobrescrever.
    const maybeSet = (key: 'client_email' | 'internal_notes' | 'lost_reason') => {
      const wasReadable = src[key] !== undefined && src[key] !== null;
      const userTyped = !!form[key]?.trim();
      if (wasReadable || userTyped) payload[key] = form[key];
    };
    maybeSet('client_email');
    maybeSet('internal_notes');
    maybeSet('lost_reason');

    const { error } = await supabase.from('leads').update(payload as any).eq('id', lead.id);

    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      await logAuditAction({
        action: 'update',
        resource_type: 'lead',
        resource_id: lead.id,
        details: { changes: payload },
      });
      toast.success('Lead atualizado!');
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog open={!!lead} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar Lead
            {hydrating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Carregando dados completos" />}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome do cliente</Label>
            <Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.client_email}
                onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                placeholder={hydrating ? 'Carregando...' : '—'}
              />
            </div>
          </div>
          <div>
            <Label>Serviço solicitado</Label>
            <Input value={form.service_needed} onChange={e => setForm(f => ({ ...f, service_needed: e.target.value }))} />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prestador</Label>
              <Select value={form.provider_id} onValueChange={v => setForm(f => ({ ...f, provider_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {providers.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.business_name || p.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Notas internas</Label>
            <Textarea
              value={form.internal_notes}
              onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))}
              rows={2}
              placeholder={hydrating ? 'Carregando...' : 'Visível apenas para administradores'}
            />
          </div>
          {form.status === 'closed' && (
            <div>
              <Label>Motivo da perda</Label>
              <Input
                value={form.lost_reason}
                onChange={e => setForm(f => ({ ...f, lost_reason: e.target.value }))}
              />
            </div>
          )}

          {history.length > 0 && (
            <div className="rounded-md border border-border p-2">
              <h4 className="flex items-center gap-1 text-xs font-semibold mb-1.5">
                <History className="h-3 w-3" /> Histórico ({history.length})
              </h4>
              <ul className="space-y-1 text-[11px] text-muted-foreground max-h-32 overflow-y-auto">
                {history.map(h => (
                  <li key={h.id} className="flex justify-between gap-2">
                    <span>
                      {h.status_from || '—'} → <strong>{h.status_to || '—'}</strong>
                      {h.note ? ` · ${h.note}` : ''}
                    </span>
                    <span className="shrink-0">{new Date(h.created_at).toLocaleDateString('pt-BR')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || hydrating}>
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LeadEditDialog;

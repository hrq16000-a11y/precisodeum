import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
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
    service_needed: '',
    message: '',
    status: 'new',
    provider_id: '',
  });
  const [providers, setProviders] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setForm({
        client_name: lead.client_name || '',
        phone: lead.phone || '',
        service_needed: lead.service_needed || '',
        message: lead.message || '',
        status: lead.status || 'new',
        provider_id: lead.provider_id || '',
      });
    }
  }, [lead]);

  useEffect(() => {
    supabase.from('providers').select('id, business_name').eq('status', 'approved').order('business_name')
      .then(({ data }) => setProviders(data || []));
  }, []);

  const handleSave = async () => {
    if (!lead) return;
    setSaving(true);

    const { error } = await supabase.from('leads')
      .update({
        client_name: form.client_name,
        phone: form.phone,
        service_needed: form.service_needed,
        message: form.message,
        status: form.status,
        provider_id: form.provider_id,
      } as any)
      .eq('id', lead.id);

    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      await logAuditAction({
        action: 'update',
        resource_type: 'lead',
        resource_id: lead.id,
        details: { changes: form },
      });
      toast.success('Lead atualizado!');
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog open={!!lead} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome do cliente</Label>
            <Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LeadEditDialog;

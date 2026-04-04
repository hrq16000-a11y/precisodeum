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

interface ServiceEditDialogProps {
  service: any | null;
  onClose: () => void;
  onSaved: () => void;
}

const ServiceEditDialog = ({ service, onClose, onSaved }: ServiceEditDialogProps) => {
  const [form, setForm] = useState({
    service_name: '',
    description: '',
    price: '',
    whatsapp: '',
    service_area: '',
    working_hours: '',
    address: '',
    category_id: '',
    provider_id: '',
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (service) {
      setForm({
        service_name: service.service_name || '',
        description: service.description || '',
        price: service.price || '',
        whatsapp: service.whatsapp || '',
        service_area: service.service_area || '',
        working_hours: service.working_hours || '',
        address: service.address || '',
        category_id: service.category_id || '',
        provider_id: service.provider_id || '',
      });
    }
  }, [service]);

  useEffect(() => {
    supabase.from('categories').select('id, name').is('deleted_at', null).order('name')
      .then(({ data }) => setCategories(data || []));
    supabase.from('providers').select('id, business_name').eq('status', 'approved').order('business_name')
      .then(({ data }) => setProviders(data || []));
  }, []);

  const handleSave = async () => {
    if (!service) return;
    setSaving(true);

    const updateData: any = {
      service_name: form.service_name,
      description: form.description,
      price: form.price,
      whatsapp: form.whatsapp,
      service_area: form.service_area,
      working_hours: form.working_hours,
      address: form.address,
      provider_id: form.provider_id,
    };
    if (form.category_id) updateData.category_id = form.category_id;

    const { error } = await supabase.from('services').update(updateData).eq('id', service.id);
    setSaving(false);

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      await logAuditAction({
        action: 'update',
        resource_type: 'service',
        resource_id: service.id,
        details: { changes: form },
      });
      toast.success('Serviço atualizado!');
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog open={!!service} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Serviço</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <Label>Nome do serviço</Label>
            <Input value={form.service_name} onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Preço</Label>
              <Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="A partir de R$ ..." />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Área de atuação</Label>
              <Input value={form.service_area} onChange={e => setForm(f => ({ ...f, service_area: e.target.value }))} />
            </div>
            <div>
              <Label>Horário</Label>
              <Input value={form.working_hours} onChange={e => setForm(f => ({ ...f, working_hours: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Endereço</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prestador (reatribuir)</Label>
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

export default ServiceEditDialog;

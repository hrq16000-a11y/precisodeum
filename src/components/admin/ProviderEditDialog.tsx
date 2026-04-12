import { useState, useEffect } from 'react';
import CategoryIcon from '@/components/CategoryIcon';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';

interface Props {
  provider: any;
  onClose: () => void;
  onSaved: () => void;
}

const ProviderEditDialog = ({ provider, onClose, onSaved }: Props) => {
  const [form, setForm] = useState({
    business_name: provider.business_name || '',
    city: provider.city || '',
    state: provider.state || '',
    neighborhood: provider.neighborhood || '',
    cnpj: provider.cnpj || '',
    phone: provider.phone || '',
    whatsapp: provider.whatsapp || '',
    description: provider.description || '',
    category_id: provider.category_id || '',
    website: provider.website || '',
    working_hours: provider.working_hours || '',
    years_experience: provider.years_experience || 0,
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('categories').select('id, name, icon').is('deleted_at', null).order('name')
      .then(({ data }) => setCategories(data || []));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('providers').update({
      business_name: form.business_name || null,
      city: form.city,
      state: form.state,
      neighborhood: form.neighborhood,
      cnpj: form.cnpj || null,
      phone: form.phone,
      whatsapp: form.whatsapp,
      description: form.description,
      category_id: form.category_id || null,
      website: form.website || null,
      working_hours: form.working_hours || null,
      years_experience: Number(form.years_experience) || 0,
    }).eq('id', provider.id);

    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      await logAuditAction({ action: 'update', resource_type: 'provider', resource_id: provider.id });
      toast.success('Prestador atualizado!');
      onSaved();
      onClose();
    }
    setSaving(false);
  };

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Prestador</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Nome Fantasia</Label>
              <Input value={form.business_name} onChange={e => update('business_name', e.target.value)} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={e => update('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Cidade</Label>
              <Input value={form.city} onChange={e => update('city', e.target.value)} />
            </div>
            <div>
              <Label>Estado</Label>
              <Input value={form.state} onChange={e => update('state', e.target.value)} maxLength={2} />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={e => update('phone', e.target.value)} />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={e => update('whatsapp', e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={form.category_id} onValueChange={v => update('category_id', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-1.5">
                      <CategoryIcon icon={c.icon} size={14} /> {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Website</Label>
              <Input value={form.website} onChange={e => update('website', e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Experiência (anos)</Label>
              <Input type="number" value={form.years_experience} onChange={e => update('years_experience', e.target.value)} min={0} />
            </div>
          </div>
          <div>
            <Label>Horário de Funcionamento</Label>
            <Input value={form.working_hours} onChange={e => update('working_hours', e.target.value)} placeholder="Seg-Sex 8h-18h" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={e => update('description', e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProviderEditDialog;

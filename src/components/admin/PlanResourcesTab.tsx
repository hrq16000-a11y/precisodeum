import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, GripVertical, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { logAuditAction } from '@/hooks/useAuditLog';

interface Resource {
  id: string;
  name: string;
  icon: string;
  description: string;
  active: boolean;
  display_order: number;
}

const emptyForm = (): Omit<Resource, 'id'> => ({
  name: '',
  icon: '✅',
  description: '',
  active: true,
  display_order: 0,
});

const PlanResourcesTab = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetchResources = async () => {
    const { data } = await supabase.from('plan_resources').select('*').order('display_order');
    setResources((data as Resource[]) || []);
  };

  useEffect(() => { fetchResources(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm(), display_order: resources.length });
    setShowDialog(true);
  };

  const openEdit = (r: Resource) => {
    setEditingId(r.id);
    setForm({ name: r.name, icon: r.icon, description: r.description, active: r.active, display_order: r.display_order });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    const payload = { name: form.name.trim(), icon: form.icon, description: form.description.trim(), active: form.active, display_order: form.display_order };
    if (editingId) {
      const { error } = await supabase.from('plan_resources').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId);
      if (error) toast.error('Erro: ' + error.message);
      else { await logAuditAction({ action: 'update', resource_type: 'plan_resource', resource_id: editingId, details: payload }); toast.success('Recurso atualizado!'); }
    } else {
      const { error } = await supabase.from('plan_resources').insert(payload);
      if (error) toast.error('Erro: ' + error.message);
      else { await logAuditAction({ action: 'create', resource_type: 'plan_resource', details: payload }); toast.success('Recurso criado!'); }
    }
    setSaving(false); setShowDialog(false); fetchResources();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir o recurso "${name}"?`)) return;
    const { error } = await supabase.from('plan_resources').delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else { await logAuditAction({ action: 'delete', resource_type: 'plan_resource', resource_id: id }); toast.success('Excluído!'); fetchResources(); }
  };

  const toggleActive = async (r: Resource) => {
    const { error } = await supabase.from('plan_resources').update({ active: !r.active, updated_at: new Date().toISOString() }).eq('id', r.id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success(r.active ? 'Desativado' : 'Ativado'); fetchResources(); }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{resources.length} recurso(s) · {resources.filter(r => r.active).length} ativo(s)</p>
        <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Recurso</Button>
      </div>

      <div className="space-y-2">
        {resources.map(r => (
          <div key={r.id} className={`flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card transition-opacity ${!r.active ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              <span className="text-lg shrink-0">{r.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground truncate">{r.name}</h3>
                  {!r.active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                </div>
                {r.description && <p className="text-xs text-muted-foreground truncate">{r.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <Switch checked={r.active} onCheckedChange={() => toggleActive(r)} />
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(r)}><Edit2 className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(r.id, r.name)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
        {resources.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum recurso cadastrado</p>
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Recurso' : 'Novo Recurso'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>Ícone</Label>
                <Input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} className="text-center text-lg" maxLength={4} />
              </div>
              <div className="col-span-3">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Suporte Prioritário" />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Opcional" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ordem</Label>
                <Input type="number" min={0} value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
                <Label>Ativo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PlanResourcesTab;

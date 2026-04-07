import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreditCard, Plus, Edit2, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { logAuditAction } from '@/hooks/useAuditLog';

const COLOR_OPTIONS = [
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#10b981', label: 'Verde' },
  { value: '#6b7280', label: 'Cinza' },
  { value: '#f59e0b', label: 'Amarelo' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#14b8a6', label: 'Teal' },
];

const RESOURCE_OPTIONS = [
  'API Access', 'Priority Support', 'Email Support', 'Community Support',
  'Custom Integrations', 'Unlimited Storage', '100GB Storage', '50GB Storage',
  '10GB Storage', '5GB Storage', 'Advanced Analytics', 'Basic Analytics',
  'SSO', 'Basic Collaboration', 'Basic Features', 'Limited Access',
  'Basic Resources', '14 Days Trial',
];

const emptyForm = () => ({
  name: '',
  description: '',
  color: '#3b82f6',
  max_users: 0,
  price: 0,
  resources: [] as string[],
  display_order: 0,
});

const AdminAccountTypesPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [types, setTypes] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetchTypes = () => {
    supabase.from('account_types').select('*').order('display_order')
      .then(({ data }) => setTypes(data || []));
  };

  useEffect(() => {
    if (isAdmin) fetchTypes();
  }, [isAdmin]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowDialog(true);
  };

  const openEdit = (t: any) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      description: t.description || '',
      color: t.color || '#3b82f6',
      max_users: t.max_users || 0,
      price: t.price || 0,
      resources: Array.isArray(t.resources) ? t.resources : [],
      display_order: t.display_order || 0,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      color: form.color,
      max_users: form.max_users,
      price: form.price,
      resources: form.resources,
      display_order: form.display_order,
    };

    if (editingId) {
      const { error } = await supabase.from('account_types').update(payload).eq('id', editingId);
      if (error) toast.error('Erro: ' + error.message);
      else {
        await logAuditAction({ action: 'update', resource_type: 'account_type', resource_id: editingId, details: payload });
        toast.success('Tipo de conta atualizado!');
      }
    } else {
      const { error } = await supabase.from('account_types').insert(payload);
      if (error) toast.error('Erro: ' + error.message);
      else {
        await logAuditAction({ action: 'create', resource_type: 'account_type', details: payload });
        toast.success('Tipo de conta criado!');
      }
    }
    setSaving(false);
    setShowDialog(false);
    fetchTypes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este tipo de conta?')) return;
    const { error } = await supabase.from('account_types').delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else {
      await logAuditAction({ action: 'delete', resource_type: 'account_type', resource_id: id });
      toast.success('Tipo de conta excluído!');
      fetchTypes();
    }
  };

  const toggleResource = (resource: string) => {
    setForm(f => ({
      ...f,
      resources: f.resources.includes(resource)
        ? f.resources.filter(r => r !== resource)
        : [...f.resources, resource],
    }));
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" /> Tipos de Conta
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie os planos e recursos disponíveis</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo Tipo</Button>
      </div>

      <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {types.map(t => {
          const resources = Array.isArray(t.resources) ? t.resources : [];
          return (
            <Card key={t.id} className="relative overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: t.color }} />
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-display font-bold text-foreground">{t.name}</h3>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                        {resources.length} recurso(s)
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(t)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{t.description || '—'}</p>
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Até {t.max_users} usuários
                  </span>
                  <span className="font-semibold text-foreground">R$ {Number(t.price).toFixed(2)}/mês</span>
                </div>
                <div className="mt-3">
                  <p className="text-[10px] text-muted-foreground mb-1">Recursos principais:</p>
                  <div className="flex flex-wrap gap-1">
                    {resources.slice(0, 4).map((r: string) => (
                      <Badge key={r} variant="outline" className="text-[10px]" style={{ borderColor: t.color, color: t.color }}>
                        {r}
                      </Badge>
                    ))}
                    {resources.length > 4 && (
                      <Badge variant="secondary" className="text-[10px]">+{resources.length - 4}</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Tipo de Conta' : 'Adicionar Novo Tipo de Conta'}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {editingId ? 'Atualize as informações do plano.' : 'Crie um novo plano com recursos e limitações específicas.'}
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Plano *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Enterprise" />
            </div>
            <div>
              <Label>Descrição *</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva os benefícios deste plano" rows={3} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Cor</Label>
                <Select value={form.color} onValueChange={v => setForm(f => ({ ...f, color: v }))}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: form.color }} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: c.value }} />
                          {c.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Máx. Usuários</Label>
                <Input type="number" min={0} value={form.max_users} onChange={e => setForm(f => ({ ...f, max_users: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input type="number" min={0} step={0.01} value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Recursos Incluídos</Label>
              <div className="grid grid-cols-2 gap-2">
                {RESOURCE_OPTIONS.map(r => (
                  <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.resources.includes(r)} onCheckedChange={() => toggleResource(r)} />
                    {r}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminAccountTypesPage;

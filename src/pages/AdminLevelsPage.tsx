import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, Plus, Edit2, Trash2, Users } from 'lucide-react';
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
  { value: '#f59e0b', label: 'Amarelo' },
  { value: '#10b981', label: 'Verde' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#6b7280', label: 'Cinza' },
  { value: '#14b8a6', label: 'Teal' },
];

const PERMISSION_KEYS = [
  { key: 'create_users', label: 'Criar Usuários' },
  { key: 'edit_users', label: 'Editar Usuários' },
  { key: 'delete_users', label: 'Excluir Usuários' },
  { key: 'view_users', label: 'Visualizar Usuários' },
  { key: 'manage_settings', label: 'Gerenciar Configurações' },
  { key: 'view_reports', label: 'Visualizar Relatórios' },
  { key: 'manage_billing', label: 'Gerenciar Faturamento' },
];

const emptyForm = () => ({
  name: '',
  description: '',
  color: '#3b82f6',
  priority: 50,
  permissions: {} as Record<string, boolean>,
});

const AdminLevelsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [levels, setLevels] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [levelCounts, setLevelCounts] = useState<Record<string, number>>({});

  const fetchLevels = async () => {
    const { data } = await supabase.from('user_levels').select('*').order('priority', { ascending: false });
    setLevels(data || []);
    // Fetch usage counts
    const { data: profiles } = await supabase.from('profiles').select('level_id');
    const counts: Record<string, number> = {};
    (profiles || []).forEach((p: any) => {
      if (p.level_id) counts[p.level_id] = (counts[p.level_id] || 0) + 1;
    });
    setLevelCounts(counts);
  };

  useEffect(() => {
    if (isAdmin) fetchLevels();
  }, [isAdmin]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowDialog(true);
  };

  const openEdit = (level: any) => {
    setEditingId(level.id);
    setForm({
      name: level.name,
      description: level.description || '',
      color: level.color || '#3b82f6',
      priority: level.priority || 0,
      permissions: (level.permissions as Record<string, boolean>) || {},
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
      priority: form.priority,
      permissions: form.permissions,
    };

    if (editingId) {
      const { error } = await supabase.from('user_levels').update(payload).eq('id', editingId);
      if (error) toast.error('Erro: ' + error.message);
      else {
        await logAuditAction({ action: 'update', resource_type: 'user_level', resource_id: editingId, details: payload });
        toast.success('Nível atualizado!');
      }
    } else {
      const { error } = await supabase.from('user_levels').insert(payload);
      if (error) toast.error('Erro: ' + error.message);
      else {
        await logAuditAction({ action: 'create', resource_type: 'user_level', details: payload });
        toast.success('Nível criado!');
      }
    }
    setSaving(false);
    setShowDialog(false);
    fetchLevels();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este nível?')) return;
    const { error } = await supabase.from('user_levels').delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else {
      await logAuditAction({ action: 'delete', resource_type: 'user_level', resource_id: id });
      toast.success('Nível excluído!');
      fetchLevels();
    }
  };

  const togglePerm = (key: string) => {
    setForm(f => ({
      ...f,
      permissions: { ...f.permissions, [key]: !f.permissions[key] },
    }));
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Níveis de Acesso
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie os níveis de acesso com permissões específicas</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo Nível</Button>
      </div>

      <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {levels.map(level => {
          const perms = (level.permissions as Record<string, boolean>) || {};
          const activePerms = PERMISSION_KEYS.filter(p => perms[p.key]);
          return (
            <Card key={level.id} className="relative overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: level.color }} />
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: level.color }} />
                    <h3 className="font-display font-bold text-foreground">{level.name}</h3>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(level)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(level.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{level.description || '—'}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Prioridade: <strong>{level.priority}</strong></span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <strong>{levelCounts[level.id] || 0}</strong> usuário(s)
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {activePerms.length > 0 ? activePerms.map(p => (
                    <Badge key={p.key} variant="outline" className="text-[10px]">{p.label}</Badge>
                  )) : (
                    <span className="text-xs text-muted-foreground italic">Sem permissões</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Nível' : 'Adicionar Novo Nível'}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {editingId ? 'Atualize as informações do nível de acesso.' : 'Crie um novo nível de acesso com permissões específicas.'}
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Nível *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Administrador" />
            </div>
            <div>
              <Label>Descrição *</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva as permissões deste nível" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                <Label>Prioridade (0-100)</Label>
                <Input type="number" min={0} max={100} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Permissões</Label>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSION_KEYS.map(p => (
                  <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={!!form.permissions[p.key]} onCheckedChange={() => togglePerm(p.key)} />
                    {p.label}
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

export default AdminLevelsPage;

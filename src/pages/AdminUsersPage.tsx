import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Edit2, X, Search, Users, Shield, Trash2, Ban, Key, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import PaginationControls from '@/components/PaginationControls';

const PROFILE_TYPE_OPTIONS = [
  { value: 'client', label: 'Cliente' },
  { value: 'provider', label: 'Profissional' },
  { value: 'rh', label: 'Agência / RH' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
];

const profileTypeLabel = (t: string) => PROFILE_TYPE_OPTIONS.find(o => o.value === t)?.label || t;
const profileTypeBadge = (t: string) => {
  if (t === 'rh') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
  if (t === 'provider') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  return 'bg-muted text-muted-foreground';
};

const PAGE_SIZE = 20;

const AdminUsersPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);

  // Edit dialog state
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '', email: '', phone: '', whatsapp: '',
    profile_type: '', status: '',
  });
  const [saving, setSaving] = useState(false);

  // Password reset dialog
  const [pwUser, setPwUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPw, setResettingPw] = useState(false);

  // Delete confirm
  const [deleteUser, setDeleteUser] = useState<any | null>(null);

  // Expanded row (mobile)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchProfiles = () => {
    supabase.from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setProfiles(data || []));
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchProfiles();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    let list = profiles;
    if (filterType !== 'all') {
      list = list.filter(p => (p.profile_type || p.role) === filterType);
    }
    if (filterStatus !== 'all') {
      list = list.filter(p => (p.status || 'active') === filterStatus);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.whatsapp || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [profiles, search, filterType, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openEdit = (p: any) => {
    setEditUser(p);
    setEditForm({
      full_name: p.full_name || '',
      email: p.email || '',
      phone: p.phone || '',
      whatsapp: p.whatsapp || '',
      profile_type: p.profile_type || p.role || 'client',
      status: p.status || 'active',
    });
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);

    // Sanitize whatsapp: keep only digits
    const sanitizedWhatsapp = (editForm.whatsapp || '').replace(/\D/g, '');

    const { error } = await supabase.from('profiles').update({
      full_name: editForm.full_name,
      phone: editForm.phone,
      whatsapp: sanitizedWhatsapp,
      role: editForm.profile_type === 'rh' ? 'client' : editForm.profile_type,
      profile_type: editForm.profile_type,
      status: editForm.status,
    } as any).eq('id', editUser.id);

    setSaving(false);
    if (error) {
      toast.error('Erro ao atualizar: ' + error.message);
    } else {
      toast.success('Usuário atualizado!');
      setEditUser(null);
      fetchProfiles();
    }
  };

  const handleResetPassword = async () => {
    if (!pwUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }
    setResettingPw(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('admin-reset-password', {
        body: { user_id: pwUser.id, new_password: newPassword },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      toast.success('Senha redefinida com sucesso!');
      setPwUser(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Falha ao redefinir senha'));
    }
    setResettingPw(false);
  };

  const handleBlock = async (p: any) => {
    const newStatus = (p.status || 'active') === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('profiles').update({ status: newStatus } as any).eq('id', p.id);
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success(newStatus === 'active' ? 'Usuário desbloqueado!' : 'Usuário bloqueado!');
      fetchProfiles();
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    // We can't delete auth users from client, but we can deactivate
    const { error } = await supabase.from('profiles').update({ status: 'inactive' } as any).eq('id', deleteUser.id);
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success('Usuário desativado com sucesso!');
      setDeleteUser(null);
      fetchProfiles();
    }
  };

  const makeAdmin = async (userId: string) => {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' } as any);
    if (error) {
      if (error.code === '23505') toast.info('Usuário já é admin');
      else toast.error('Erro: ' + error.message);
    } else {
      toast.success('Usuário promovido a admin!');
    }
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  const stats = {
    total: profiles.length,
    active: profiles.filter(p => (p.status || 'active') === 'active').length,
    inactive: profiles.filter(p => p.status === 'inactive').length,
    clients: profiles.filter(p => (p.profile_type || p.role) === 'client').length,
    providers: profiles.filter(p => (p.profile_type || p.role) === 'provider').length,
    rh: profiles.filter(p => (p.profile_type || p.role) === 'rh').length,
  };

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <Users className="h-6 w-6" /> Gerenciar Usuários
      </h1>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Ativos', value: stats.active, color: 'text-green-600' },
          { label: 'Inativos', value: stats.inactive, color: 'text-destructive' },
          { label: 'Clientes', value: stats.clients, color: 'text-muted-foreground' },
          { label: 'Profissionais', value: stats.providers, color: 'text-blue-500' },
          { label: 'Agências', value: stats.rh, color: 'text-purple-500' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-2.5 shadow-card text-center">
            <p className={`font-display text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, e-mail, telefone, WhatsApp..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {PROFILE_TYPE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{filtered.length} resultado(s)</p>

      {/* Table */}
      <div className="mt-3 overflow-x-auto rounded-xl border border-border shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Nome</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">E-mail</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Telefone</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Tipo</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Status</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(p => {
              const isInactive = p.status === 'inactive';
              return (
                <tr key={p.id} className={`border-b border-border bg-card hover:bg-muted/30 transition-colors ${isInactive ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground truncate max-w-[160px]">{p.full_name || '—'}</p>
                    <p className="text-[10px] text-muted-foreground sm:hidden truncate">{p.email || ''}</p>
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell text-muted-foreground text-xs truncate max-w-[200px]">{p.email || '—'}</td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground text-xs">{p.phone || p.whatsapp || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${profileTypeBadge(p.profile_type || p.role)}`}>
                      {profileTypeLabel(p.profile_type || p.role)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell">
                    <Badge variant={isInactive ? 'destructive' : 'default'} className="text-[10px]">
                      {isInactive ? 'Inativo' : 'Ativo'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)} title="Editar">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPwUser(p)} title="Redefinir Senha">
                        <Key className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleBlock(p)} title={isInactive ? 'Desbloquear' : 'Bloquear'}>
                        <Ban className={`h-3.5 w-3.5 ${isInactive ? 'text-green-600' : 'text-destructive'}`} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => makeAdmin(p.id)} title="Promover a Admin">
                        <Shield className="h-3.5 w-3.5 text-amber-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteUser(p)} title="Desativar">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {paginated.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4">
          <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={open => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome completo</Label>
              <Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input value={editForm.email} disabled className="opacity-70" />
              <p className="text-[10px] text-muted-foreground mt-1">E-mail não pode ser alterado diretamente</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input value={editForm.whatsapp} onChange={e => setEditForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="DDD + número" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de conta</Label>
                <Select value={editForm.profile_type} onValueChange={v => setEditForm(f => ({ ...f, profile_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROFILE_TYPE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={!!pwUser} onOpenChange={open => !open && setPwUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Redefinir senha de <strong>{pwUser?.full_name || pwUser?.email}</strong>
          </p>
          <div>
            <Label>Nova senha (mín. 6 caracteres)</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nova senha" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPwUser(null); setNewPassword(''); }}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={resettingPw || newPassword.length < 6}>
              <Key className="h-4 w-4 mr-1" /> {resettingPw ? 'Redefinindo...' : 'Redefinir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete/Deactivate Confirm */}
      <Dialog open={!!deleteUser} onOpenChange={open => !open && setDeleteUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Desativar Usuário</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja realmente desativar <strong>{deleteUser?.full_name || deleteUser?.email}</strong>?
            O usuário será marcado como inativo e não poderá acessar a plataforma.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUsersPage;

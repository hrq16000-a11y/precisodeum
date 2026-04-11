import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Key, Trash2, Download, CheckSquare, UserCog, Shield, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PaginationControls from '@/components/PaginationControls';
import UserStatsCards from '@/components/admin/UserStatsCards';
import UserFilters from '@/components/admin/UserFilters';
import UserTable from '@/components/admin/UserTable';
import UserEditDialog from '@/components/admin/UserEditDialog';
import UserDetailSheet from '@/components/admin/UserDetailSheet';
import BulkActionsBar from '@/components/admin/BulkActionsBar';
import { logAuditAction } from '@/hooks/useAuditLog';

const PAGE_SIZE = 20;

const AdminUsersPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [levels, setLevels] = useState<any[]>([]);
  const [accountTypes, setAccountTypes] = useState<any[]>([]);
  const [providersMap, setProvidersMap] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProviderStatus, setFilterProviderStatus] = useState('all');
  const [page, setPage] = useState(1);

  const [editUser, setEditUser] = useState<any | null>(null);
  const [pwUser, setPwUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPw, setResettingPw] = useState(false);
  const [deleteUser, setDeleteUser] = useState<any | null>(null);
  const [detailUser, setDetailUser] = useState<any | null>(null);

  // Create user
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState('client');
  const [creating, setCreating] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkTypeTarget, setBulkTypeTarget] = useState('');
  const [bulkStatusTarget, setBulkStatusTarget] = useState('');

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    const allPageIds = paginated.map(p => p.id);
    const allSelected = allPageIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allPageIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allPageIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map(p => p.id)));
  };

  const fetchProfiles = () => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setProfiles(data || []));
    supabase.from('providers').select('id, user_id, business_name, city, state, plan, status, slug, categories(name, icon)')
      .is('deleted_at', null)
      .then(({ data }) => {
        const map: Record<string, any> = {};
        (data || []).forEach((p: any) => { map[p.user_id] = p; });
        setProvidersMap(map);
      });
  };

  const fetchAdmins = () => {
    supabase.from('user_roles').select('user_id').eq('role', 'admin')
      .then(({ data }) => setAdminIds(new Set((data || []).map((r: any) => r.user_id))));
  };

  const fetchLevels = () => {
    supabase.from('user_levels').select('*').order('priority', { ascending: false })
      .then(({ data }) => setLevels(data || []));
  };
  const fetchAccountTypes = () => {
    supabase.from('account_types').select('*').order('display_order')
      .then(({ data }) => setAccountTypes(data || []));
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchProfiles();
    fetchAdmins();
    fetchLevels();
    fetchAccountTypes();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    let list = profiles;
    if (filterType !== 'all') list = list.filter(p => (p.profile_type || p.role) === filterType);
    if (filterStatus !== 'all') list = list.filter(p => (p.status || 'active') === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.whatsapp || '').toLowerCase().includes(q) ||
        (p.id || '').toLowerCase().includes(q) ||
        (p.user_ref || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [profiles, search, filterType, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Bulk actions
  const bulkSetStatus = async (status: string) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('profiles').update({ status }).in('id', ids);
    if (error) toast.error('Erro: ' + error.message);
    else {
      await logAuditAction({ action: status === 'active' ? 'bulk_active' : 'bulk_inactive', resource_type: 'user', details: { ids, count: ids.length } });
      toast.success(`${ids.length} usuário(s) ${status === 'active' ? 'ativado(s)' : 'desativado(s)'}`);
      setSelectedIds(new Set());
      fetchProfiles();
    }
    setBulkLoading(false);
  };

  const bulkChangeType = async (profileType: string) => {
    if (selectedIds.size === 0 || !profileType) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const role = profileType === 'rh' ? 'client' : profileType;
    const { error } = await supabase.from('profiles').update({ profile_type: profileType, role }).in('id', ids);
    if (error) toast.error('Erro: ' + error.message);
    else {
      await logAuditAction({ action: 'bulk_update', resource_type: 'user', details: { ids, count: ids.length, changes: { profile_type: profileType } } });
      toast.success(`${ids.length} usuário(s) alterado(s) para ${profileType === 'provider' ? 'Profissional' : profileType === 'rh' ? 'Agência/RH' : 'Cliente'}`);
      setSelectedIds(new Set());
      fetchProfiles();
    }
    setBulkLoading(false);
    setBulkTypeTarget('');
  };

  const bulkMakeAdmin = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds).filter(id => !adminIds.has(id));
    if (ids.length === 0) { toast.info('Todos já são admins'); setBulkLoading(false); return; }
    let count = 0;
    for (const id of ids) {
      const { error } = await supabase.from('user_roles').insert({ user_id: id, role: 'admin' } as any);
      if (!error) count++;
    }
    await logAuditAction({ action: 'bulk_update', resource_type: 'user', details: { ids, count, changes: { role: 'admin' } } });
    toast.success(`${count} usuário(s) promovido(s) a admin`);
    setSelectedIds(new Set());
    fetchAdmins();
    setBulkLoading(false);
  };

  const bulkSoftDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('profiles').update({ status: 'inactive' }).in('id', ids);
    if (error) toast.error('Erro: ' + error.message);
    else {
      await logAuditAction({ action: 'bulk_delete', resource_type: 'user', details: { ids, count: ids.length } });
      toast.success(`${ids.length} usuário(s) desativado(s)`);
      setSelectedIds(new Set());
      fetchProfiles();
    }
    setBulkLoading(false);
  };

  const handleResetPassword = async () => {
    if (!pwUser || !newPassword) return;
    if (newPassword.length < 6) { toast.error('A senha deve ter no mínimo 6 caracteres'); return; }
    setResettingPw(true);
    try {
      const res = await supabase.functions.invoke('admin-reset-password', {
        body: { user_id: pwUser.id, new_password: newPassword },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      await logAuditAction({
        action: 'update', resource_type: 'user', resource_id: pwUser.id,
        details: { target_user_id: pwUser.id, changes: { password: { from: '***', to: '***' } } },
      });
      toast.success('Senha redefinida com sucesso!');
      setPwUser(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Falha ao redefinir senha'));
    }
    setResettingPw(false);
  };

  const handleBlock = async (p: any) => {
    const prevStatus = p.status || 'active';
    const newStatus = prevStatus === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', p.id);
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      await logAuditAction({
        action: newStatus === 'inactive' ? 'block' : 'unblock', resource_type: 'user', resource_id: p.id,
        details: { target_user_id: p.id, changes: { status: { from: prevStatus, to: newStatus } } },
      });
      toast.success(newStatus === 'active' ? 'Usuário desbloqueado!' : 'Usuário bloqueado!');
      fetchProfiles();
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    const prevStatus = deleteUser.status || 'active';
    const { error } = await supabase.from('profiles').update({ status: 'inactive' }).eq('id', deleteUser.id);
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      await logAuditAction({
        action: 'soft_delete', resource_type: 'user', resource_id: deleteUser.id,
        details: { target_user_id: deleteUser.id, changes: { status: { from: prevStatus, to: 'inactive' } }, reason: 'Soft delete via admin' },
      });
      toast.success('Usuário desativado!');
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
      await logAuditAction({
        action: 'update', resource_type: 'user', resource_id: userId,
        details: { target_user_id: userId, changes: { role: { from: 'user', to: 'admin' } } },
      });
      toast.success('Usuário promovido a admin!');
      fetchAdmins();
    }
  };

  const removeAdmin = async (userId: string) => {
    const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      await logAuditAction({
        action: 'update', resource_type: 'user', resource_id: userId,
        details: { target_user_id: userId, changes: { role: { from: 'admin', to: 'user' } } },
      });
      toast.success('Permissão de admin removida!');
      fetchAdmins();
    }
  };

  const handleExport = () => {
    const csvHeader = 'Nome,Email,Telefone,WhatsApp,Tipo,Status,Criado em\n';
    const source = selectedIds.size > 0 ? filtered.filter(p => selectedIds.has(p.id)) : filtered;
    const csvRows = source.map(p =>
      `"${p.full_name || ''}","${p.email || ''}","${p.phone || ''}","${p.whatsapp || ''}","${p.profile_type || p.role || ''}","${p.status || 'active'}","${p.created_at || ''}"`
    ).join('\n');
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logAuditAction({ action: 'export', resource_type: 'user', details: { count: source.length } });
    toast.success(`${source.length} usuário(s) exportado(s)!`);
  };

  const handleCreateUser = async () => {
    if (!createEmail.includes('@')) { toast.error('Email inválido'); return; }
    if (createPassword.length < 6) { toast.error('Senha mínima: 6 caracteres'); return; }
    if (createName.trim().length < 2) { toast.error('Nome mínimo: 2 caracteres'); return; }
    setCreating(true);
    try {
      const res = await supabase.functions.invoke('admin-create-user', {
        body: { email: createEmail, password: createPassword, full_name: createName, profile_type: createType },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      await logAuditAction({
        action: 'create', resource_type: 'user', resource_id: res.data?.user_id,
        details: { email: createEmail, profile_type: createType },
      });
      toast.success('Usuário criado com sucesso!');
      setShowCreateDialog(false);
      setCreateEmail(''); setCreatePassword(''); setCreateName(''); setCreateType('client');
      fetchProfiles();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Falha ao criar usuário'));
    }
    setCreating(false);
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  const stats = {
    total: profiles.length,
    active: profiles.filter(p => (p.status || 'active') === 'active').length,
    inactive: profiles.filter(p => p.status === 'inactive').length,
    clients: profiles.filter(p => (p.profile_type || p.role) === 'client').length,
    providers: profiles.filter(p => (p.profile_type || p.role) === 'provider').length,
    rh: profiles.filter(p => (p.profile_type || p.role) === 'rh').length,
    admins: adminIds.size,
  };

  const allPageSelected = paginated.length > 0 && paginated.every(p => selectedIds.has(p.id));

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6" /> Gestão de Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie todos os usuários da plataforma</p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <UserPlus className="h-4 w-4 mr-1" /> Criar Usuário
        </Button>
      </div>

      <div className="mt-5"><UserStatsCards stats={stats} /></div>

      <div className="mt-4">
        <UserFilters
          search={search}
          onSearchChange={v => { setSearch(v); setPage(1); }}
          filterType={filterType}
          onFilterTypeChange={v => { setFilterType(v); setPage(1); }}
          filterStatus={filterStatus}
          onFilterStatusChange={v => { setFilterStatus(v); setPage(1); }}
          totalResults={filtered.length}
          onExport={handleExport}
        />
      </div>

      {/* Select all bar */}
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={selectAllOnPage}>
          <CheckSquare className="h-3.5 w-3.5" />
          {allPageSelected ? 'Desmarcar Página' : 'Selecionar Página'}
        </Button>
        {filtered.length > PAGE_SIZE && (
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={selectAllFiltered}>
            <CheckSquare className="h-3.5 w-3.5" />
            Selecionar Todos ({filtered.length})
          </Button>
        )}
        {selectedIds.size > 0 && (
          <span className="text-xs text-muted-foreground">{selectedIds.size} selecionado(s)</span>
        )}
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="mt-3 sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 shadow-sm">
          <span className="text-sm font-medium text-foreground mr-2">
            {selectedIds.size} selecionado(s)
          </span>

          {/* Status */}
          <Button size="sm" variant="outline" onClick={() => bulkSetStatus('active')} disabled={bulkLoading} className="text-green-600 border-green-200 h-7 text-xs">
            ✅ Ativar
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkSetStatus('inactive')} disabled={bulkLoading} className="text-destructive border-destructive/30 h-7 text-xs">
            🔴 Desativar
          </Button>

          {/* Change type */}
          <div className="flex items-center gap-1">
            <Select value={bulkTypeTarget} onValueChange={setBulkTypeTarget}>
              <SelectTrigger className="h-7 w-[130px] text-xs">
                <SelectValue placeholder="Mudar tipo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">👤 Cliente</SelectItem>
                <SelectItem value="provider">🔧 Profissional</SelectItem>
                <SelectItem value="rh">🏢 Agência/RH</SelectItem>
              </SelectContent>
            </Select>
            {bulkTypeTarget && (
              <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => bulkChangeType(bulkTypeTarget)} disabled={bulkLoading}>
                <UserCog className="h-3 w-3 mr-1" /> Aplicar
              </Button>
            )}
          </div>

          {/* Promote to admin */}
          <Button size="sm" variant="outline" onClick={bulkMakeAdmin} disabled={bulkLoading} className="h-7 text-xs text-amber-600 border-amber-200">
            <Shield className="h-3 w-3 mr-1" /> Promover Admin
          </Button>

          {/* Export */}
          <Button size="sm" variant="outline" onClick={handleExport} disabled={bulkLoading} className="h-7 text-xs">
            <Download className="h-3 w-3 mr-1" /> Exportar
          </Button>

          {/* Delete */}
          <Button size="sm" variant="destructive" onClick={bulkSoftDelete} disabled={bulkLoading} className="h-7 text-xs">
            <Trash2 className="h-3 w-3 mr-1" /> Desativar
          </Button>

          {/* Clear */}
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="h-7 text-xs ml-auto">
            ✕ Limpar
          </Button>
        </div>
      )}

      <div className="mt-3">
        <UserTable
          users={paginated}
          adminIds={adminIds}
          levels={levels}
          accountTypes={accountTypes}
          providersMap={providersMap}
          onEdit={setEditUser}
          onResetPassword={setPwUser}
          onBlock={handleBlock}
          onMakeAdmin={makeAdmin}
          onRemoveAdmin={removeAdmin}
          onDelete={setDeleteUser}
          onViewDetails={setDetailUser}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
        />
      </div>

      {totalPages > 1 && (
        <div className="mt-4">
          <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}

      {editUser && <UserEditDialog user={editUser} onClose={() => setEditUser(null)} onSaved={fetchProfiles} />}
      <UserDetailSheet user={detailUser} isAdmin={adminIds.has(detailUser?.id)} onClose={() => setDetailUser(null)} onRefresh={fetchProfiles} />

      {/* Password Reset Dialog */}
      <Dialog open={!!pwUser} onOpenChange={open => !open && setPwUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Redefinir Senha</DialogTitle></DialogHeader>
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
          <DialogHeader><DialogTitle>Desativar Usuário</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja realmente desativar <strong>{deleteUser?.full_name || deleteUser?.email}</strong>?
            <br /><span className="text-xs">Os dados do usuário serão preservados (soft delete).</span>
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Criar Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome completo</Label>
              <Input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Nome do usuário" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div>
              <Label>Senha (mín. 6 caracteres)</Label>
              <Input type="password" value={createPassword} onChange={e => setCreatePassword(e.target.value)} placeholder="Senha inicial" />
            </div>
            <div>
              <Label>Tipo de conta</Label>
              <Select value={createType} onValueChange={setCreateType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Cliente</SelectItem>
                  <SelectItem value="provider">Profissional</SelectItem>
                  <SelectItem value="rh">Agência/RH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUsersPage;

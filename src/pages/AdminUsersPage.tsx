import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Key, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import PaginationControls from '@/components/PaginationControls';
import UserStatsCards from '@/components/admin/UserStatsCards';
import UserFilters from '@/components/admin/UserFilters';
import UserTable from '@/components/admin/UserTable';
import UserEditDialog from '@/components/admin/UserEditDialog';
import UserDetailSheet from '@/components/admin/UserDetailSheet';

const PAGE_SIZE = 20;

const AdminUsersPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);

  const [editUser, setEditUser] = useState<any | null>(null);
  const [pwUser, setPwUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPw, setResettingPw] = useState(false);
  const [deleteUser, setDeleteUser] = useState<any | null>(null);
  const [detailUser, setDetailUser] = useState<any | null>(null);

  const fetchProfiles = () => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setProfiles(data || []));
  };

  const fetchAdmins = () => {
    supabase.from('user_roles').select('user_id').eq('role', 'admin')
      .then(({ data }) => setAdminIds(new Set((data || []).map((r: any) => r.user_id))));
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchProfiles();
    fetchAdmins();
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
        (p.whatsapp || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [profiles, search, filterType, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', p.id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success(newStatus === 'active' ? 'Usuário desbloqueado!' : 'Usuário bloqueado!'); fetchProfiles(); }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    const { error } = await supabase.from('profiles').update({ status: 'inactive' }).eq('id', deleteUser.id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Usuário desativado!'); setDeleteUser(null); fetchProfiles(); }
  };

  const makeAdmin = async (userId: string) => {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' } as any);
    if (error) {
      if (error.code === '23505') toast.info('Usuário já é admin');
      else toast.error('Erro: ' + error.message);
    } else {
      toast.success('Usuário promovido a admin!');
      fetchAdmins();
    }
  };

  const handleExport = () => {
    const csvHeader = 'Nome,Email,Telefone,WhatsApp,Tipo,Status,Criado em\n';
    const csvRows = filtered.map(p =>
      `"${p.full_name || ''}","${p.email || ''}","${p.phone || ''}","${p.whatsapp || ''}","${p.profile_type || p.role || ''}","${p.status || 'active'}","${p.created_at || ''}"`
    ).join('\n');
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
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

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <Users className="h-6 w-6" /> Gerenciar Usuários
      </h1>

      <div className="mt-4">
        <UserStatsCards stats={stats} />
      </div>

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

      <div className="mt-3">
        <UserTable
          users={paginated}
          adminIds={adminIds}
          onEdit={setEditUser}
          onResetPassword={setPwUser}
          onBlock={handleBlock}
          onMakeAdmin={makeAdmin}
          onDelete={setDeleteUser}
          onViewDetails={setDetailUser}
        />
      </div>

      {totalPages > 1 && (
        <div className="mt-4">
          <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}

      {/* Edit Dialog */}
      {editUser && <UserEditDialog user={editUser} onClose={() => setEditUser(null)} onSaved={fetchProfiles} />}

      {/* Detail Sheet */}
      <UserDetailSheet user={detailUser} isAdmin={adminIds.has(detailUser?.id)} onClose={() => setDetailUser(null)} />

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

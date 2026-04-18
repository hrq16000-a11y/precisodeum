import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, UserPlus, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';

interface StaffMember {
  id: string;
  user_id: string;
  role: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-destructive/15 text-destructive border-destructive/30',
  moderator: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  analyst: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  moderator: 'Moderador',
  analyst: 'Analista',
};

const AdminStaffPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { logAction } = useAuditLog();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<string>('moderator');
  const [adding, setAdding] = useState(false);

  const fetchStaff = async () => {
    // Get all user_roles entries with profile info
    const { data: roles } = await supabase
      .from('user_roles')
      .select('id, user_id, role, created_at');

    if (!roles || roles.length === 0) {
      setStaff([]);
      setLoadingData(false);
      return;
    }

    const userIds = roles.map((r: any) => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    setStaff(roles.map((r: any) => {
      const p = profileMap.get(r.user_id) || {};
      return {
        id: r.id,
        user_id: r.user_id,
        role: r.role,
        email: (p as any).email || '',
        full_name: (p as any).full_name || 'Sem nome',
        avatar_url: (p as any).avatar_url || null,
        created_at: r.created_at,
      };
    }));
    setLoadingData(false);
  };

  useEffect(() => { if (isAdmin) fetchStaff(); }, [isAdmin]);

  const handleAddStaff = async () => {
    if (!newEmail.trim()) { toast.error('E-mail é obrigatório'); return; }
    setAdding(true);

    // Find user by email
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', newEmail.trim().toLowerCase())
      .maybeSingle();

    if (!profile) {
      toast.error('Usuário não encontrado com este e-mail');
      setAdding(false);
      return;
    }

    // Check if already has this role
    const existing = staff.find(s => s.user_id === profile.id && s.role === newRole);
    if (existing) {
      toast.error(`Este usuário já possui o cargo de ${ROLE_LABELS[newRole]}`);
      setAdding(false);
      return;
    }

    const { error } = await supabase.from('user_roles').insert({
      user_id: profile.id,
      role: newRole as any,
    });

    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success(`${ROLE_LABELS[newRole]} adicionado!`);
      logAction({ action: 'create', resource_type: 'user_role', details: { email: newEmail, role: newRole } });
      setNewEmail('');
      setShowAddForm(false);
      fetchStaff();
    }
    setAdding(false);
  };

  const handleRemoveRole = async (member: StaffMember) => {
    if (!confirm(`Remover ${ROLE_LABELS[member.role]} de ${member.full_name}?`)) return;
    const { error } = await supabase.from('user_roles').delete().eq('id', member.id);
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success('Cargo removido');
      logAction({ action: 'delete', resource_type: 'user_role', resource_id: member.id, details: { email: member.email, role: member.role } });
      fetchStaff();
    }
  };

  const handleChangeRole = async (member: StaffMember, newRole: string) => {
    const { error } = await supabase.from('user_roles').update({ role: newRole as any }).eq('id', member.id);
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success(`Cargo alterado para ${ROLE_LABELS[newRole]}`);
      logAction({ action: 'update', resource_type: 'user_role', resource_id: member.id, details: { old_role: member.role, new_role: newRole } });
      fetchStaff();
    }
  };

  if (adminLoading || loadingData) return <AdminLayout><p className="text-muted-foreground p-6">Carregando...</p></AdminLayout>;

  const filtered = staff.filter(s => {
    const q = search.toLowerCase();
    return !q || s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || ROLE_LABELS[s.role]?.toLowerCase().includes(q);
  });

  const grouped = {
    admin: filtered.filter(s => s.role === 'admin'),
    moderator: filtered.filter(s => s.role === 'moderator'),
    analyst: filtered.filter(s => s.role === 'analyst'),
  };

  return (
    <AdminLayout>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Staff & Acessos
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gerencie administradores, moderadores e analistas</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {(['admin', 'moderator', 'analyst'] as const).map(r => {
          const count = staff.filter(s => s.role === r).length;
          return (
            <Card key={r} className="border-border/60">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{ROLE_LABELS[r]}</p>
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                </div>
                <Badge className={ROLE_COLORS[r]} variant="outline">{r === 'admin' ? 'ADM' : r === 'moderator' ? 'MOD' : 'ANL'}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <UserPlus className="h-4 w-4 mr-1.5" /> Adicionar Membro
        </Button>
      </div>

      {showAddForm && (
        <Card className="mb-6 border-primary/30">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Adicionar novo membro ao Staff</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="E-mail do usuário cadastrado..."
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="flex-1"
              />
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="moderator">Moderador</SelectItem>
                  <SelectItem value="analyst">Analista</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddStaff} disabled={adding}>
                {adding ? 'Adicionando...' : 'Confirmar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.entries(grouped).map(([role, members]) => {
        if (members.length === 0) return null;
        return (
          <div key={role} className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
              <Badge className={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Badge>
              <span className="text-xs">({members.length})</span>
            </h3>
            <div className="grid gap-2">
              {members.map(member => (
                <Card key={member.id}>
                  <CardContent className="p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                          {member.avatar_url ? (
                            <img src={member.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            member.full_name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{member.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Select value={member.role} onValueChange={v => handleChangeRole(member, v)}>
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="moderator">Moderador</SelectItem>
                            <SelectItem value="analyst">Analista</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" className="text-destructive h-8" onClick={() => handleRemoveRole(member)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum membro do staff encontrado</p>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminStaffPage;

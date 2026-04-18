import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ShieldCheck, Briefcase, ClipboardCheck, SearchCode, Loader2, Users,
  Mail, Calendar, ExternalLink, Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type StaffRoleKey = 'admin' | 'gerente' | 'supervisor' | 'analista';

interface StaffMember {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  staff_role: StaffRoleKey | null;
  created_at: string;
  isAdminRole: boolean; // from user_roles table
}

const ROLE_META: Record<StaffRoleKey, { label: string; icon: typeof Briefcase; color: string; bg: string }> = {
  admin: { label: 'Administrador', icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  gerente: { label: 'Gerente', icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  supervisor: { label: 'Supervisor', icon: ClipboardCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  analista: { label: 'Analista', icon: SearchCode, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
};

const PERMISSIONS: { key: string; label: string; description: string }[] = [
  { key: 'view_finance', label: 'Financeiro', description: 'Acessar receita, planos e cobranças' },
  { key: 'view_leads', label: 'Leads', description: 'Visualizar e gerenciar leads recebidos' },
  { key: 'approve_providers', label: 'Aprovação', description: 'Aprovar/rejeitar prestadores e vagas' },
  { key: 'edit_users', label: 'Edição de Usuários', description: 'Editar perfis, níveis e planos' },
  { key: 'manage_content', label: 'Conteúdo', description: 'Gerenciar blog, FAQ, banners e páginas' },
  { key: 'manage_system', label: 'Sistema', description: 'Configurações, módulos e auditoria' },
];

const MATRIX_ROLES: { key: 'gerente' | 'supervisor' | 'analista'; label: string; icon: typeof Briefcase; color: string }[] = [
  { key: 'gerente', label: 'Gerente', icon: Briefcase, color: 'text-blue-600' },
  { key: 'supervisor', label: 'Supervisor', icon: ClipboardCheck, color: 'text-emerald-600' },
  { key: 'analista', label: 'Analista', icon: SearchCode, color: 'text-purple-600' },
];

const AdminStaffPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | StaffRoleKey>('all');
  const [savingId, setSavingId] = useState<string | null>(null);

  // Permissions matrix state
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [permsLoading, setPermsLoading] = useState(true);
  const [savingPerm, setSavingPerm] = useState<string | null>(null);

  const loadStaff = async () => {
    setLoading(true);
    const [rolesRes, profilesStaffRes] = await Promise.all([
      supabase.from('user_roles').select('user_id').eq('role', 'admin'),
      (supabase.from('profiles') as any)
        .select('id, full_name, email, avatar_url, staff_role, created_at')
        .in('staff_role', ['gerente', 'supervisor', 'analista']),
    ]);

    const adminIds = new Set<string>((rolesRes.data || []).map((r: any) => r.user_id));

    let adminProfiles: any[] = [];
    if (adminIds.size > 0) {
      const { data } = await (supabase.from('profiles') as any)
        .select('id, full_name, email, avatar_url, staff_role, created_at')
        .in('id', Array.from(adminIds));
      adminProfiles = data || [];
    }

    const map = new Map<string, StaffMember>();
    adminProfiles.forEach((p: any) => {
      map.set(p.id, { ...p, isAdminRole: true });
    });
    (profilesStaffRes.data || []).forEach((p: any) => {
      const existing = map.get(p.id);
      map.set(p.id, { ...p, isAdminRole: existing?.isAdminRole || adminIds.has(p.id) });
    });

    setMembers(Array.from(map.values()).sort((a, b) =>
      (a.full_name || a.email || '').localeCompare(b.full_name || b.email || '')
    ));
    setLoading(false);
  };

  const loadPerms = async () => {
    setPermsLoading(true);
    const { data, error } = await (supabase.from('staff_permissions' as any) as any)
      .select('role, permission_key, enabled');
    if (error) {
      toast.error('Erro ao carregar matriz de permissões');
      setPermsLoading(false);
      return;
    }
    const map: Record<string, boolean> = {};
    (data || []).forEach((row: any) => {
      map[`${row.role}:${row.permission_key}`] = row.enabled;
    });
    setPerms(map);
    setPermsLoading(false);
  };

  useEffect(() => {
    if (isAdmin) {
      loadStaff();
      loadPerms();
    }
  }, [isAdmin]);

  const updateStaffRole = async (userId: string, newRole: 'none' | 'gerente' | 'supervisor' | 'analista') => {
    setSavingId(userId);
    const { error } = await (supabase.from('profiles') as any)
      .update({ staff_role: newRole === 'none' ? null : newRole })
      .eq('id', userId);
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success(newRole === 'none' ? 'Cargo removido' : `Cargo definido: ${ROLE_META[newRole as StaffRoleKey].label}`);
      await loadStaff();
    }
    setSavingId(null);
  };

  const togglePerm = async (role: 'gerente' | 'supervisor' | 'analista', key: string, current: boolean) => {
    const cellId = `${role}:${key}`;
    setSavingPerm(cellId);
    setPerms((p) => ({ ...p, [cellId]: !current }));

    const { error } = await (supabase.rpc as any)('admin_set_staff_permission', {
      _role: role,
      _permission_key: key,
      _enabled: !current,
    });

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      setPerms((p) => ({ ...p, [cellId]: current }));
    } else {
      toast.success(`${MATRIX_ROLES.find((r) => r.key === role)?.label} → ${PERMISSIONS.find((p) => p.key === key)?.label}: ${!current ? 'liberado' : 'bloqueado'}`);
    }
    setSavingPerm(null);
  };

  const filtered = members.filter((m) => {
    if (filterRole !== 'all') {
      const effectiveRole: StaffRoleKey = m.isAdminRole ? 'admin' : (m.staff_role as StaffRoleKey) || 'analista';
      if (effectiveRole !== filterRole) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.full_name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q);
  });

  const counts = {
    admin: members.filter((m) => m.isAdminRole).length,
    gerente: members.filter((m) => !m.isAdminRole && m.staff_role === 'gerente').length,
    supervisor: members.filter((m) => !m.isAdminRole && m.staff_role === 'supervisor').length,
    analista: members.filter((m) => !m.isAdminRole && m.staff_role === 'analista').length,
  };

  if (adminLoading || !isAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Staff & Acessos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pessoas com cargo administrativo na plataforma e a matriz de permissões por cargo.
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Apenas Admin
          </Badge>
        </header>

        {/* Counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(ROLE_META) as StaffRoleKey[]).map((role) => {
            const meta = ROLE_META[role];
            const Icon = meta.icon;
            return (
              <Card key={role} className="border-border">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${meta.bg}`}>
                    <Icon className={`h-5 w-5 ${meta.color}`} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold tabular-nums">{counts[role]}</div>
                    <div className="text-xs text-muted-foreground">{meta.label}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="equipe" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="equipe" className="gap-2">
              <Users className="h-4 w-4" /> Equipe ({members.length})
            </TabsTrigger>
            <TabsTrigger value="matriz" className="gap-2">
              <ShieldCheck className="h-4 w-4" /> Matriz de Permissões
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Equipe */}
          <TabsContent value="equipe" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou e-mail..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={filterRole} onValueChange={(v) => setFilterRole(v as any)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os cargos</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="analista">Analista</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum membro encontrado.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {filtered.map((m) => {
                      const effectiveRole: StaffRoleKey = m.isAdminRole ? 'admin' : (m.staff_role as StaffRoleKey) || 'analista';
                      const meta = ROLE_META[effectiveRole];
                      const Icon = meta.icon;
                      return (
                        <div key={m.id} className="flex flex-wrap items-center gap-3 p-4 hover:bg-muted/30">
                          <div className="h-10 w-10 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
                            {m.avatar_url ? (
                              <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Users className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-[180px]">
                            <div className="font-medium text-sm">{m.full_name || '— sem nome —'}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                              <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {m.email || '—'}</span>
                              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(m.created_at).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className={`gap-1 ${meta.color} border-current/30`}>
                            <Icon className="h-3 w-3" /> {meta.label}
                          </Badge>
                          {m.isAdminRole ? (
                            <Badge variant="secondary" className="text-xs">Acesso total (admin)</Badge>
                          ) : (
                            <Select
                              value={m.staff_role || 'none'}
                              onValueChange={(v) => updateStaffRole(m.id, v as any)}
                              disabled={savingId === m.id}
                            >
                              <SelectTrigger className="w-[150px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sem cargo</SelectItem>
                                <SelectItem value="gerente">Gerente</SelectItem>
                                <SelectItem value="supervisor">Supervisor</SelectItem>
                                <SelectItem value="analista">Analista</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/usuarios?id=${m.id}`)}
                            className="gap-1.5"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Abrir
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB 2: Matriz */}
          <TabsContent value="matriz" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Matriz de Permissões por Cargo
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  <strong>Administrador</strong> tem acesso total e não aparece nesta matriz.
                  Mudanças refletem instantaneamente no que cada cargo enxerga.
                </p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {permsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 font-semibold w-[280px]">Permissão</th>
                        {MATRIX_ROLES.map((r) => {
                          const Icon = r.icon;
                          return (
                            <th key={r.key} className="text-center py-3 px-2 font-semibold">
                              <div className="flex flex-col items-center gap-1">
                                <Icon className={`h-5 w-5 ${r.color}`} />
                                <span>{r.label}</span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSIONS.map((p) => (
                        <tr key={p.key} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-3 px-2">
                            <div className="font-medium">{p.label}</div>
                            <div className="text-xs text-muted-foreground">{p.description}</div>
                          </td>
                          {MATRIX_ROLES.map((r) => {
                            const cellId = `${r.key}:${p.key}`;
                            const enabled = !!perms[cellId];
                            const isSaving = savingPerm === cellId;
                            return (
                              <td key={r.key} className="text-center py-3 px-2">
                                <button
                                  onClick={() => togglePerm(r.key, p.key, enabled)}
                                  disabled={isSaving}
                                  className={`inline-flex h-6 w-11 rounded-full transition-colors ${
                                    enabled ? 'bg-primary' : 'bg-muted'
                                  } ${isSaving ? 'opacity-50' : ''}`}
                                >
                                  <span
                                    className={`h-5 w-5 rounded-full bg-background shadow transition-transform mt-0.5 ${
                                      enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                                    }`}
                                  />
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminStaffPage;

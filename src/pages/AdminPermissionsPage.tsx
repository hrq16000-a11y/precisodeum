import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ShieldCheck, Briefcase, ClipboardCheck, SearchCode, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type StaffRole = 'gerente' | 'supervisor' | 'analista';

const PERMISSIONS: { key: string; label: string; description: string }[] = [
  { key: 'view_finance', label: 'Financeiro', description: 'Acessar receita, planos e cobranças' },
  { key: 'view_leads', label: 'Leads', description: 'Visualizar e gerenciar leads recebidos' },
  { key: 'approve_providers', label: 'Aprovação', description: 'Aprovar/rejeitar prestadores e vagas' },
  { key: 'edit_users', label: 'Edição de Usuários', description: 'Editar perfis, níveis e planos' },
  { key: 'manage_content', label: 'Conteúdo', description: 'Gerenciar blog, FAQ, banners e páginas' },
  { key: 'manage_system', label: 'Sistema', description: 'Configurações, módulos e auditoria' },
];

const ROLES: { key: StaffRole; label: string; icon: typeof Briefcase; color: string }[] = [
  { key: 'gerente', label: 'Gerente', icon: Briefcase, color: 'text-blue-600' },
  { key: 'supervisor', label: 'Supervisor', icon: ClipboardCheck, color: 'text-emerald-600' },
  { key: 'analista', label: 'Analista', icon: SearchCode, color: 'text-purple-600' },
];

const AdminPermissionsPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchPermissions = async () => {
    const { data, error } = await (supabase.from('staff_permissions' as any) as any)
      .select('role, permission_key, enabled');
    if (error) {
      toast.error('Erro ao carregar permissões');
      setLoading(false);
      return;
    }
    const map: Record<string, boolean> = {};
    (data || []).forEach((row: any) => {
      map[`${row.role}:${row.permission_key}`] = row.enabled;
    });
    setPerms(map);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchPermissions();
  }, [isAdmin]);

  const toggle = async (role: StaffRole, key: string, current: boolean) => {
    const cellId = `${role}:${key}`;
    setSaving(cellId);
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
      toast.success(`${ROLES.find((r) => r.key === role)?.label} → ${PERMISSIONS.find((p) => p.key === key)?.label}: ${!current ? 'liberado' : 'bloqueado'}`);
    }
    setSaving(null);
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
      <div className="space-y-6 max-w-6xl mx-auto">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Permissões de Cargo
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Defina o que cada cargo pode fazer. <strong>Administrador</strong> tem acesso total e não aparece nesta matriz.
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Apenas Admin
          </Badge>
        </header>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Matriz de Permissões</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-semibold w-[280px]">Permissão</th>
                    {ROLES.map((r) => {
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
                      {ROLES.map((r) => {
                        const cellId = `${r.key}:${p.key}`;
                        const enabled = !!perms[cellId];
                        const isSaving = saving === cellId;
                        return (
                          <td key={r.key} className="text-center py-3 px-2">
                            <div className="flex justify-center">
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : (
                                <Switch
                                  checked={enabled}
                                  onCheckedChange={() => toggle(r.key, p.key, enabled)}
                                />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Como funciona:</strong> Cada toggle controla se o cargo tem acesso a um bloco da plataforma.
              Mudanças são aplicadas instantaneamente e registradas em <code className="px-1 bg-background rounded">system_audit_logs</code>.
              O cargo é atribuído ao usuário na aba <em>Cargo de Staff</em> do modal de Editar Usuário.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminPermissionsPage;

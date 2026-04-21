import { useState, useEffect } from 'react';
import CategoryIcon from '@/components/CategoryIcon';
import { Save, ShieldCheck, Briefcase, ClipboardCheck, SearchCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';
import { useAuth } from '@/hooks/useAuth';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
];

const COMMERCIAL_PLANS = [
  { value: 'gratuito', label: 'Gratuito', color: 'hsl(var(--muted-foreground))' },
  { value: 'prospeccao', label: 'Prospecção', color: 'hsl(var(--primary))' },
  { value: 'corporativo', label: 'Corporativo', color: 'hsl(var(--accent))' },
];

const STAFF_ROLES = [
  { value: 'none', label: 'Nenhum (usuário comum)', icon: null },
  { value: 'admin', label: 'Administrador', icon: ShieldCheck },
  { value: 'gerente', label: 'Gerente', icon: Briefcase },
  { value: 'supervisor', label: 'Supervisor', icon: ClipboardCheck },
  { value: 'analista', label: 'Analista', icon: SearchCode },
];

interface UserEditDialogProps {
  user: any | null;
  onClose: () => void;
  onSaved: () => void;
}

const UserEditDialog = ({ user, onClose, onSaved }: UserEditDialogProps) => {
  const { user: currentUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentStaffRole, setCurrentStaffRole] = useState<string>('none');

  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    whatsapp: user?.whatsapp || '',
    profile_type: user?.profile_type || user?.role || 'client',
    status: user?.status || 'active',
    level_id: user?.level_id || '',
    department: user?.department || '',
    commercial_plan: user?.commercial_plan || 'gratuito',
    staff_role: user?.staff_role || 'none',
  });
  const [saving, setSaving] = useState(false);
  const [levels, setLevels] = useState<any[]>([]);
  const [profileTypeOptions, setProfileTypeOptions] = useState<any[]>([]);

  // Determine if the editor (current user) is admin
  useEffect(() => {
    if (!currentUser) return;
    supabase.rpc('has_role', { _user_id: currentUser.id, _role: 'admin' as any })
      .then(({ data }) => setIsAdmin(!!data));
  }, [currentUser]);

  useEffect(() => {
    Promise.all([
      supabase.from('gamification_levels').select('id, name, color, icon, min_points').eq('active', true).order('min_points'),
      supabase.from('profile_type_settings' as any).select('profile_key, label, color, icon, active').eq('active', true).order('display_order'),
    ]).then(([levelsRes, profileRes]) => {
      setLevels(levelsRes.data || []);
      setProfileTypeOptions((profileRes.data as any[]) || []);
    });

    // Fetch real current values directly from profiles (in case parent row is stale)
    if (user?.id) {
      supabase.from('profiles').select('staff_role, commercial_plan').eq('id', user.id).single()
        .then(({ data }: any) => {
          if (data) {
            setCurrentStaffRole(data.staff_role || 'none');
            setForm(f => ({
              ...f,
              staff_role: data.staff_role || 'none',
              commercial_plan: data.commercial_plan || 'gratuito',
            }));
          }
        });
    }
  }, [user?.id]);

  const isProvider = form.profile_type === 'provider' || form.profile_type === 'rh';
  const showLevelAndPlan = isProvider; // Hide level/plan for clients

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const sanitizedWhatsapp = (form.whatsapp || '').replace(/\D/g, '');
    const updateData: any = {
      full_name: form.full_name,
      phone: form.phone,
      whatsapp: sanitizedWhatsapp,
      role: form.profile_type,
      profile_type: form.profile_type,
      status: form.status,
      department: form.department || '',
    };

    // Only set level/plan when provider
    if (showLevelAndPlan) {
      updateData.level_id = form.level_id || null;
      updateData.commercial_plan = form.commercial_plan || 'gratuito';
    }

    // Only admin can change staff_role; only send when actually changed
    if (isAdmin && form.staff_role !== currentStaffRole) {
      updateData.staff_role = form.staff_role === 'none' ? null : form.staff_role;
    }

    const changes: Record<string, { from: any; to: any }> = {};
    if (form.full_name !== (user.full_name || '')) changes.full_name = { from: user.full_name || '', to: form.full_name };
    if (form.phone !== (user.phone || '')) changes.phone = { from: user.phone || '', to: form.phone };
    if (sanitizedWhatsapp !== (user.whatsapp || '')) changes.whatsapp = { from: user.whatsapp || '', to: sanitizedWhatsapp };
    if (form.profile_type !== (user.profile_type || user.role || 'client')) changes.profile_type = { from: user.profile_type || user.role || 'client', to: form.profile_type };
    if (form.status !== (user.status || 'active')) changes.status = { from: user.status || 'active', to: form.status };
    if (showLevelAndPlan && form.level_id !== (user.level_id || '')) changes.level_id = { from: user.level_id || '', to: form.level_id };
    if (showLevelAndPlan && form.commercial_plan !== (user.commercial_plan || 'gratuito')) changes.commercial_plan = { from: user.commercial_plan || 'gratuito', to: form.commercial_plan };
    if (isAdmin && form.staff_role !== currentStaffRole) changes.staff_role = { from: currentStaffRole, to: form.staff_role };

    const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id);
    setSaving(false);

    if (error) {
      toast.error('Erro ao atualizar: ' + error.message);
    } else {
      if (Object.keys(changes).length > 0) {
        await logAuditAction({
          action: 'update',
          resource_type: 'user',
          resource_id: user.id,
          details: { target_user_id: user.id, changes },
        });
      }
      toast.success('Usuário atualizado!');
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome completo</Label>
            <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input value={form.email} disabled className="opacity-70" />
            <p className="text-[10px] text-muted-foreground mt-1">E-mail não pode ser alterado diretamente</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="DDD + número" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de Cadastro</Label>
              <Select value={form.profile_type} onValueChange={v => setForm(f => ({ ...f, profile_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {profileTypeOptions.length > 0
                    ? profileTypeOptions.map((o: any) => (
                        <SelectItem key={o.profile_key} value={o.profile_key}>
                          <div className="flex items-center gap-2">
                            <CategoryIcon icon={o.icon} size={16} className="text-foreground" />
                            {o.label}
                          </div>
                        </SelectItem>
                      ))
                    : <>
                        <SelectItem value="client">Cliente</SelectItem>
                        <SelectItem value="provider">Profissional</SelectItem>
                        <SelectItem value="rh">Agência / RH</SelectItem>
                      </>
                  }
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {showLevelAndPlan && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-md border bg-muted/30">
              <div>
                <Label>Nível (Gamificação)</Label>
                <Select value={form.level_id || 'none'} onValueChange={v => setForm(f => ({ ...f, level_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Automático</SelectItem>
                    {levels.map(l => (
                      <SelectItem key={l.id} value={l.id}>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                          {l.name} <span className="text-xs text-muted-foreground">({l.min_points}pts)</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Plano</Label>
                <Select value={form.commercial_plan} onValueChange={v => setForm(f => ({ ...f, commercial_plan: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMMERCIAL_PLANS.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                          {p.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {!showLevelAndPlan && (
            <div className="text-xs text-muted-foreground p-2 rounded border border-dashed">
              Nível e Plano só se aplicam a perfis Profissional/RH.
            </div>
          )}

          <div>
            <Label>Departamento</Label>
            <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Ex: TI, Vendas, Marketing..." />
          </div>

          {isAdmin && (
            <div className="p-3 rounded-md border-2 border-primary/20 bg-primary/5">
              <Label className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Cargo de Staff (Governança)
              </Label>
              <Select value={form.staff_role} onValueChange={v => setForm(f => ({ ...f, staff_role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map(r => {
                    const Icon = r.icon;
                    return (
                      <SelectItem key={r.value} value={r.value}>
                        <div className="flex items-center gap-2">
                          {Icon ? <Icon className="h-4 w-4" /> : <div className="h-4 w-4" />}
                          {r.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Define o nível de acesso interno. Apenas administradores veem este campo.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserEditDialog;

import { useState, useEffect } from 'react';
import CategoryIcon from '@/components/CategoryIcon';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
];

interface UserEditDialogProps {
  user: any | null;
  onClose: () => void;
  onSaved: () => void;
}

const UserEditDialog = ({ user, onClose, onSaved }: UserEditDialogProps) => {
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    whatsapp: user?.whatsapp || '',
    profile_type: user?.profile_type || user?.role || 'client',
    status: user?.status || 'active',
    level_id: user?.level_id || '',
    department: user?.department || '',
    account_type_id: user?.account_type_id || '',
  });
  const [saving, setSaving] = useState(false);
  const [levels, setLevels] = useState<any[]>([]);
  const [accountTypes, setAccountTypes] = useState<any[]>([]);
  const [profileTypeOptions, setProfileTypeOptions] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('user_levels').select('id, name, color').order('priority', { ascending: false }),
      supabase.from('account_types').select('id, name, color').order('display_order'),
      supabase.from('profile_type_settings' as any).select('profile_key, label, color, icon, active').eq('active', true).order('display_order'),
    ]).then(([levelsRes, accountRes, profileRes]) => {
      setLevels(levelsRes.data || []);
      setAccountTypes(accountRes.data || []);
      setProfileTypeOptions((profileRes.data as any[]) || []);
    });
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const sanitizedWhatsapp = (form.whatsapp || '').replace(/\D/g, '');
    const updateData: any = {
      full_name: form.full_name,
      phone: form.phone,
      whatsapp: sanitizedWhatsapp,
      role: form.profile_type === 'rh' ? 'client' : form.profile_type,
      profile_type: form.profile_type,
      status: form.status,
      level_id: form.level_id || null,
      department: form.department || '',
      account_type_id: form.account_type_id || null,
    };

    const changes: Record<string, { from: any; to: any }> = {};
    if (form.full_name !== (user.full_name || '')) changes.full_name = { from: user.full_name || '', to: form.full_name };
    if (form.phone !== (user.phone || '')) changes.phone = { from: user.phone || '', to: form.phone };
    if (sanitizedWhatsapp !== (user.whatsapp || '')) changes.whatsapp = { from: user.whatsapp || '', to: sanitizedWhatsapp };
    if (form.profile_type !== (user.profile_type || user.role || 'client')) changes.profile_type = { from: user.profile_type || user.role || 'client', to: form.profile_type };
    if (form.status !== (user.status || 'active')) changes.status = { from: user.status || 'active', to: form.status };
    if (form.level_id !== (user.level_id || '')) changes.level_id = { from: user.level_id || '', to: form.level_id };
    if (form.department !== (user.department || '')) changes.department = { from: user.department || '', to: form.department };
    if (form.account_type_id !== (user.account_type_id || '')) changes.account_type_id = { from: user.account_type_id || '', to: form.account_type_id };

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
      <DialogContent className="sm:max-w-md">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nível</Label>
              <Select value={form.level_id || 'none'} onValueChange={v => setForm(f => ({ ...f, level_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {levels.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                        {l.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Plano</Label>
              <Select value={form.account_type_id || 'none'} onValueChange={v => setForm(f => ({ ...f, account_type_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {accountTypes.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                        {a.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Departamento</Label>
            <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Ex: TI, Vendas, Marketing..." />
          </div>
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

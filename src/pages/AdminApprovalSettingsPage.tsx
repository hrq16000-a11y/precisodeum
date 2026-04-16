import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, Camera, MapPin, Clock, Save, ToggleRight, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { logAuditAction } from '@/hooks/useAuditLog';

interface ApprovalRules {
  auto_approve: boolean;
  require_photo: boolean;
  require_location: boolean;
  require_working_hours: boolean;
}

const defaultRules: ApprovalRules = {
  auto_approve: false,
  require_photo: false,
  require_location: true,
  require_working_hours: false,
};

const SETTINGS_KEYS: Record<keyof ApprovalRules, string> = {
  auto_approve: 'auto_approve_providers',
  require_photo: 'approval_require_photo',
  require_location: 'approval_require_location',
  require_working_hours: 'approval_require_working_hours',
};

const AdminApprovalSettingsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [rules, setRules] = useState<ApprovalRules>(defaultRules);
  const [saving, setSaving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [incompleteCount, setIncompleteCount] = useState(0);

  const fetchRules = useCallback(async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', Object.values(SETTINGS_KEYS));
    if (data) {
      const map = Object.fromEntries(data.map(d => [d.key, d.value]));
      setRules({
        auto_approve: map[SETTINGS_KEYS.auto_approve] === 'true',
        require_photo: map[SETTINGS_KEYS.require_photo] === 'true',
        require_location: map[SETTINGS_KEYS.require_location] !== 'false',
        require_working_hours: map[SETTINGS_KEYS.require_working_hours] === 'true',
      });
    }
  }, []);

  const fetchStats = useCallback(async () => {
    const { data: providers } = await supabase
      .from('providers')
      .select('id, status, photo_url, city, state, working_hours')
      .is('deleted_at', null);
    if (providers) {
      setPendingCount(providers.filter(p => p.status === 'pending').length);
      const incomplete = providers.filter(p => {
        const missingPhoto = rules.require_photo && !p.photo_url;
        const missingLocation = rules.require_location && (!p.city || p.city === 'Não informada');
        const missingHours = rules.require_working_hours && !p.working_hours;
        return p.status === 'pending' && (missingPhoto || missingLocation || missingHours);
      });
      setIncompleteCount(incomplete.length);
    }
  }, [rules]);

  useEffect(() => {
    if (isAdmin) {
      fetchRules();
    }
  }, [isAdmin, fetchRules]);

  useEffect(() => {
    if (isAdmin) fetchStats();
  }, [isAdmin, rules, fetchStats]);

  const handleSave = async () => {
    setSaving(true);
    const entries = Object.entries(SETTINGS_KEYS) as [keyof ApprovalRules, string][];
    for (const [ruleKey, settingKey] of entries) {
      const value = String(rules[ruleKey]);
      const { data: existing } = await supabase
        .from('site_settings' as any)
        .select('id')
        .eq('key', settingKey)
        .maybeSingle();
      if (existing) {
        await supabase.from('site_settings' as any).update({ value } as any).eq('key', settingKey);
      } else {
        await supabase.from('site_settings' as any).insert({ key: settingKey, value, label: settingKey, type: 'toggle' } as any);
      }
    }
    await logAuditAction({
      action: 'update',
      resource_type: 'site_settings',
      resource_id: 'approval_rules',
      details: rules,
    });
    toast.success('Configurações de aprovação salvas');
    setSaving(false);
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  const ruleItems: { key: keyof ApprovalRules; label: string; description: string; icon: React.ElementType }[] = [
    { key: 'require_photo', label: 'Exigir Foto de Perfil', description: 'Prestadores sem foto ficam como "Incompleto" na aba Pendentes', icon: Camera },
    { key: 'require_location', label: 'Exigir Localização Completa', description: 'Cidade e estado devem estar preenchidos para aprovação', icon: MapPin },
    { key: 'require_working_hours', label: 'Exigir Horário de Funcionamento', description: 'Campo de horário de atendimento deve estar preenchido', icon: Clock },
  ];

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl bg-primary/10 p-3">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Configurações de Aprovação</h1>
            <p className="text-sm text-muted-foreground">Defina as regras para aprovação automática de prestadores</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-destructive">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-foreground">{incompleteCount}</p>
              <p className="text-xs text-muted-foreground">Incompletos</p>
            </CardContent>
          </Card>
        </div>

        {/* Auto-approve toggle */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ToggleRight className="h-5 w-5 text-primary" />
              Aprovação Automática
            </CardTitle>
            <CardDescription>
              Quando ativada, prestadores que cumprirem todos os requisitos abaixo serão aprovados automaticamente ao se cadastrar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-approve" className="font-medium">
                {rules.auto_approve ? 'Ativada' : 'Desativada'}
              </Label>
              <Switch
                id="auto-approve"
                checked={rules.auto_approve}
                onCheckedChange={v => setRules(prev => ({ ...prev, auto_approve: v }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Requirements */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Requisitos para Aprovação</CardTitle>
            <CardDescription>
              Prestadores que nao cumprirem estes requisitos permanecerão na aba "Pendentes" com status "Incompleto".
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ruleItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={item.key}>
                  {idx > 0 && <Separator className="mb-4" />}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-muted p-2 mt-0.5">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <Label className="font-medium text-sm">{item.label}</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={rules[item.key] as boolean}
                      onCheckedChange={v => setRules(prev => ({ ...prev, [item.key]: v }))}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Info box */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4 mb-6 flex gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium mb-1">Como funciona?</p>
            <ul className="space-y-1 text-xs list-disc pl-4">
              <li>Se a "Aprovação Automática" estiver <strong>ativada</strong> e o prestador cumprir todos os requisitos, ele é aprovado instantaneamente.</li>
              <li>Se faltar algum requisito, o prestador fica na aba "Pendentes" com status <strong>"Incompleto"</strong> e um score de preenchimento.</li>
              <li>Prestadores incompletos nao podem ter status "Ativo" até preencherem os dados exigidos.</li>
            </ul>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </AdminLayout>
  );
};

export default AdminApprovalSettingsPage;

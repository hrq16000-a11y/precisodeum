import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings } from 'lucide-react';

const AdminSettingsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [settings, setSettings] = useState<any[]>([]);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('site_settings' as any)
      .select('*')
      .order('key');
    if (data) setSettings(data);
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchSettings();
  }, [isAdmin]);

  const toggleSetting = async (key: string, currentValue: string) => {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    const { error } = await (supabase
      .from('site_settings' as any) as any)
      .update({ value: newValue, updated_at: new Date().toISOString() })
      .eq('key', key);
    if (error) {
      toast.error('Erro ao atualizar: ' + error.message);
    } else {
      toast.success('Configuração atualizada!');
      fetchSettings();
    }
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <Settings className="h-6 w-6" /> Configurações do Site
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Habilite ou desabilite funcionalidades do site</p>

      <div className="mt-6 space-y-3">
        {settings.map((s: any) => (
          <div key={s.key} className="flex items-center justify-between rounded-xl border border-border bg-card p-5 shadow-card">
            <div>
              <h3 className="text-sm font-bold text-foreground">{s.label}</h3>
              <p className="text-xs text-muted-foreground">{s.description}</p>
            </div>
            <button
              onClick={() => toggleSetting(s.key, s.value)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                s.value === 'true' ? 'bg-accent' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform ${
                  s.value === 'true' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
};

export default AdminSettingsPage;

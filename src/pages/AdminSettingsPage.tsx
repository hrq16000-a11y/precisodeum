import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ImageUploadField from '@/components/ImageUploadField';

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

  const updateTextSetting = async (key: string, newValue: string) => {
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

  const booleanSettings = settings.filter((s: any) => s.value === 'true' || s.value === 'false');
  const textSettings = settings.filter((s: any) => s.value !== 'true' && s.value !== 'false');

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <Settings className="h-6 w-6" /> Configurações do Site
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Habilite ou desabilite funcionalidades do site</p>

      <div className="mt-6 space-y-3">
        {booleanSettings.map((s: any) => (
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

      {textSettings.length > 0 && (
        <>
          <h2 className="mt-8 font-display text-lg font-bold text-foreground">Configurações de texto e imagens</h2>
          <div className="mt-3 space-y-3">
            {textSettings.map((s: any) => (
              <TextSettingRow key={s.key} setting={s} onSave={updateTextSetting} />
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  );
};

const TextSettingRow = ({ setting, onSave }: { setting: any; onSave: (key: string, value: string) => Promise<void> }) => {
  const [value, setValue] = useState(setting.value);
  const changed = value !== setting.value;
  const isImageSetting = setting.key.includes('logo') || setting.key.includes('image') || setting.key.includes('banner') || setting.key.includes('icon');

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-2">
      <div>
        <h3 className="text-sm font-bold text-foreground">{setting.label}</h3>
        <p className="text-xs text-muted-foreground">{setting.description}</p>
      </div>
      {isImageSetting ? (
        <ImageUploadField
          value={value}
          onChange={(url) => { setValue(url); onSave(setting.key, url); }}
          bucket="service-images"
          folder="settings"
          label=""
          placeholder="https://exemplo.com/logo.png"
        />
      ) : (
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          {changed && (
            <Button variant="accent" size="sm" onClick={() => onSave(setting.key, value)}>
              <Save className="mr-1 h-3 w-3" /> Salvar
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminSettingsPage;

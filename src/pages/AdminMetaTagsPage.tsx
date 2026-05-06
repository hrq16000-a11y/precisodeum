import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Globe, Save, Plus, Trash2, Pencil, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const defaultPages = [
  { page_path: '/', page_label: 'Homepage' },
  { page_path: '/buscar', page_label: 'Buscar' },
  { page_path: '/sobre', page_label: 'Sobre' },
];

const AdminMetaTagsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [settings, setSettings] = useState<any[]>([]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('site_settings' as any).select('*').order('key');
    if (data) setSettings(data);
  };

  useEffect(() => { if (isAdmin) fetchSettings(); }, [isAdmin]);

  const metaSettings = [
    { key: 'meta_title_home', label: 'Título da Homepage', description: 'Tag <title> da página inicial' },
    { key: 'meta_description_home', label: 'Descrição da Homepage', description: 'Meta description da página inicial' },
    { key: 'meta_og_image', label: 'Imagem OG padrão', description: 'URL da imagem para compartilhamento em redes sociais' },
    { key: 'google_search_console_id', label: 'Google Search Console', description: 'ID de verificação do Google Search Console (content da meta tag)' },
    { key: 'google_analytics_id', label: 'Google Analytics ID', description: 'ID do Google Analytics (ex: G-XXXXXXX)' },
  ];

  const getValue = (key: string) => {
    const s = settings.find((s: any) => s.key === key);
    return s?.value || '';
  };

  const saveSetting = async (key: string, value: string, label: string, description: string) => {
    const exists = settings.find((s: any) => s.key === key);
    if (exists) {
      const { error } = await (supabase.from('site_settings' as any) as any)
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await (supabase.from('site_settings' as any) as any)
        .insert([{ key, value, label, description }]);
      if (error) { toast.error(error.message); return; }
    }
    toast.success('Salvo!');
    fetchSettings();
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <Globe className="h-6 w-6" /> Meta Tags & SEO
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Configure meta tags, Google Search Console e analytics</p>

      <div className="mt-6 space-y-4">
        {metaSettings.map(ms => (
          <MetaSettingRow
            key={ms.key}
            label={ms.label}
            description={ms.description}
            value={getValue(ms.key)}
            onSave={(val) => saveSetting(ms.key, val, ms.label, ms.description)}
            multiline={ms.key === 'meta_description_home'}
          />
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-muted/30 p-5">
        <h3 className="font-display font-bold text-foreground flex items-center gap-2">
          <Search className="h-4 w-4" /> Integração Google Search Console
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Para verificar o site no Google Search Console, adicione o ID de verificação acima. A meta tag será injetada automaticamente em todas as páginas.
          A integração com a API de indexação será habilitada futuramente.
        </p>
      </div>
    </AdminLayout>
  );
};

const MetaSettingRow = ({ label, description, value: initialValue, onSave, multiline }: {
  label: string; description: string; value: string; onSave: (val: string) => Promise<void>; multiline?: boolean;
}) => {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValue(initialValue); }, [initialValue]);

  const changed = value !== initialValue;

  const handleSave = async () => {
    setSaving(true);
    await onSave(value);
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-2">
      <div>
        <h3 className="text-sm font-bold text-foreground">{label}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-2">
        {multiline ? (
          <Textarea value={value} onChange={e => setValue(e.target.value)} className="flex-1" rows={2} />
        ) : (
          <Input value={value} onChange={e => setValue(e.target.value)} className="flex-1" />
        )}
        {changed && (
          <Button variant="accent" size="sm" onClick={handleSave} disabled={saving}>
            <Save className="mr-1 h-3 w-3" /> Salvar
          </Button>
        )}
      </div>
    </div>
  );
};

export default AdminMetaTagsPage;

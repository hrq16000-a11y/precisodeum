import { useState, useEffect, useRef } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Globe, Save, Search, Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { compressImage } from '@/lib/compressImage';

const AdminMetaTagsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [settings, setSettings] = useState<any[]>([]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('site_settings' as any).select('*').order('key');
    if (data) setSettings(data);
  };

  useEffect(() => { if (isAdmin) fetchSettings(); }, [isAdmin]);

  const metaSettings = [
    { key: 'meta_title_home', label: 'Título da Homepage', description: 'Tag <title> da página inicial', type: 'text' },
    { key: 'meta_description_home', label: 'Descrição da Homepage', description: 'Meta description da página inicial', type: 'textarea' },
    { key: 'meta_og_image', label: 'Imagem OG padrão', description: 'Imagem para compartilhamento em redes sociais (1200×630px recomendado)', type: 'image' },
    { key: 'google_search_console_id', label: 'Google Search Console', description: 'ID de verificação do Google Search Console (content da meta tag)', type: 'text' },
    { key: 'google_analytics_id', label: 'Google Analytics ID', description: 'ID do Google Analytics (ex: G-XXXXXXX)', type: 'text' },
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
            settingKey={ms.key}
            label={ms.label}
            description={ms.description}
            value={getValue(ms.key)}
            onSave={(val) => saveSetting(ms.key, val, ms.label, ms.description)}
            type={ms.type as 'text' | 'textarea' | 'image'}
          />
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-muted/30 p-5">
        <h3 className="font-display font-bold text-foreground flex items-center gap-2">
          <Search className="h-4 w-4" /> Integração Google Search Console
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Para verificar o site no Google Search Console, adicione o ID de verificação acima. A meta tag será injetada automaticamente em todas as páginas.
        </p>
      </div>
    </AdminLayout>
  );
};

const MetaSettingRow = ({ settingKey, label, description, value: initialValue, onSave, type = 'text' }: {
  settingKey: string;
  label: string;
  description: string;
  value: string;
  onSave: (val: string) => Promise<void>;
  type?: 'text' | 'textarea' | 'image';
}) => {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setValue(initialValue); }, [initialValue]);

  const changed = value !== initialValue;

  const handleSave = async () => {
    setSaving(true);
    await onSave(value);
    setSaving(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 5MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `settings/og-image-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('service-images')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('service-images')
        .getPublicUrl(path);

      setValue(publicUrl);
      // Auto-save after upload
      setSaving(true);
      await onSave(publicUrl);
      setSaving(false);
      toast.success('Imagem OG atualizada!');
    } catch (err: any) {
      toast.error('Erro no upload: ' + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleClearImage = async () => {
    setValue('');
    setSaving(true);
    await onSave('');
    setSaving(false);
  };

  if (type === 'image') {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">{label}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        {value ? (
          <div className="space-y-2">
            <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30">
              <img
                src={value}
                alt="OG Image Preview"
                className="w-full max-h-48 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <p className="text-xs text-muted-foreground break-all font-mono">{value}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-3 w-3 mr-1" />
                {uploading ? 'Enviando...' : 'Substituir'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearImage}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-3 w-3 mr-1" /> Remover
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 p-8 cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {uploading ? 'Enviando...' : 'Clique para enviar imagem OG'}
            </p>
            <p className="text-xs text-muted-foreground/60">Recomendado: 1200×630px, PNG ou JPG</p>
          </div>
        )}

        {/* URL manual */}
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Ou cole uma URL diretamente..."
            className="flex-1 text-xs"
          />
          {changed && (
            <Button variant="accent" size="sm" onClick={handleSave} disabled={saving}>
              <Save className="mr-1 h-3 w-3" /> Salvar
            </Button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-2">
      <div>
        <h3 className="text-sm font-bold text-foreground">{label}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-2">
        {type === 'textarea' ? (
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

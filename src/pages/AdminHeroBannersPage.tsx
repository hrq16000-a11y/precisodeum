import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import ImageUploadField from '@/components/ImageUploadField';
import {
  Image as ImageIcon, Plus, Save, Trash2, Eye, GripVertical,
  ArrowUp, ArrowDown, Monitor, Smartphone, Globe,
} from 'lucide-react';

interface HeroBanner {
  id: string;
  title: string;
  subtitle: string;
  cta_text: string;
  cta_link: string;
  image_url: string | null;
  overlay_opacity: number;
  text_alignment: string;
  animation_type: string;
  animation_duration: number;
  animation_delay: number;
  display_order: number;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  target_device: string;
  target_city: string | null;
  target_state: string | null;
  created_at: string;
  updated_at: string;
}

const emptyBanner: Omit<HeroBanner, 'id' | 'created_at' | 'updated_at'> = {
  title: 'Encontre profissionais para qualquer serviço',
  subtitle: '',
  cta_text: 'Cadastrar agora',
  cta_link: '/cadastro',
  image_url: null,
  overlay_opacity: 0.8,
  text_alignment: 'center',
  animation_type: 'fade',
  animation_duration: 500,
  animation_delay: 0,
  display_order: 0,
  active: true,
  start_date: null,
  end_date: null,
  target_device: 'all',
  target_city: null,
  target_state: null,
};

const AdminHeroBannersPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [editing, setEditing] = useState<HeroBanner | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewBanner, setPreviewBanner] = useState<HeroBanner | null>(null);

  const fetchBanners = async () => {
    const { data } = await (supabase.from('hero_banners' as any).select('*').order('display_order') as any);
    if (data) setBanners(data);
  };

  useEffect(() => {
    if (isAdmin) fetchBanners();
  }, [isAdmin]);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const payload = {
      title: editing.title,
      subtitle: editing.subtitle,
      cta_text: editing.cta_text,
      cta_link: editing.cta_link,
      image_url: editing.image_url,
      overlay_opacity: editing.overlay_opacity,
      text_alignment: editing.text_alignment,
      animation_type: editing.animation_type,
      animation_duration: editing.animation_duration,
      animation_delay: editing.animation_delay,
      display_order: editing.display_order,
      active: editing.active,
      start_date: editing.start_date || null,
      end_date: editing.end_date || null,
      target_device: editing.target_device,
      target_city: editing.target_city || null,
      target_state: editing.target_state || null,
      updated_at: new Date().toISOString(),
    };

    if ('id' in editing && editing.id) {
      const { error } = await (supabase.from('hero_banners' as any) as any).update(payload).eq('id', editing.id);
      if (error) toast.error('Erro: ' + error.message);
      else toast.success('Banner atualizado!');
    } else {
      const { error } = await (supabase.from('hero_banners' as any) as any).insert(payload);
      if (error) toast.error('Erro: ' + error.message);
      else toast.success('Banner criado!');
    }
    setSaving(false);
    setEditing(null);
    fetchBanners();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este banner?')) return;
    await (supabase.from('hero_banners' as any) as any).delete().eq('id', id);
    toast.success('Banner excluído');
    fetchBanners();
  };

  const handleReorder = async (id: string, direction: 'up' | 'down') => {
    const idx = banners.findIndex(b => b.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= banners.length) return;
    const updates = [
      { id: banners[idx].id, display_order: banners[swapIdx].display_order },
      { id: banners[swapIdx].id, display_order: banners[idx].display_order },
    ];
    await Promise.all(updates.map(u =>
      (supabase.from('hero_banners' as any) as any).update({ display_order: u.display_order }).eq('id', u.id)
    ));
    fetchBanners();
  };

  const getStatusLabel = (b: HeroBanner) => {
    if (!b.active) return { label: 'Inativo', color: 'bg-muted text-muted-foreground' };
    const now = new Date();
    if (b.start_date && new Date(b.start_date) > now) return { label: 'Agendado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
    if (b.end_date && new Date(b.end_date) < now) return { label: 'Expirado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
    return { label: 'Ativo', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <ImageIcon className="h-6 w-6" /> Banners do Hero
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie os banners exibidos na página inicial</p>
        </div>
        <Button variant="accent" onClick={() => setEditing({ ...emptyBanner, display_order: banners.length } as any)}>
          <Plus className="mr-1 h-4 w-4" /> Novo Banner
        </Button>
      </div>

      {/* Banner list */}
      <div className="mt-6 space-y-3">
        {banners.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <p className="text-muted-foreground">Nenhum banner cadastrado. O hero usará o padrão do sistema.</p>
          </div>
        )}
        {banners.map((b, idx) => {
          const status = getStatusLabel(b);
          return (
            <div key={b.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex flex-col gap-1">
                <button onClick={() => handleReorder(b.id, 'up')} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button onClick={() => handleReorder(b.id, 'down')} disabled={idx === banners.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
              {b.image_url && (
                <img src={b.image_url} alt="" className="h-14 w-20 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground truncate">{b.title || '(Sem título)'}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${status.color}`}>{status.label}</span>
                  {b.target_device !== 'all' && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      {b.target_device === 'mobile' ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                      {b.target_device}
                    </span>
                  )}
                  {(b.target_city || b.target_state) && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Globe className="h-3 w-3" /> {b.target_city || b.target_state}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setPreviewBanner(b)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(b.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview modal */}
      {previewBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreviewBanner(null)}>
          <div className="w-full max-w-3xl rounded-xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="relative py-16 md:py-24">
              {previewBanner.image_url && (
                <img src={previewBanner.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              <div className="absolute inset-0" style={{ backgroundColor: `rgba(249, 115, 22, ${previewBanner.overlay_opacity})` }} />
              <div className={`relative z-10 px-6 text-${previewBanner.text_alignment}`}>
                <h2 className="text-2xl md:text-4xl font-extrabold text-white">{previewBanner.title}</h2>
                {previewBanner.subtitle && <p className="mt-2 text-white/80">{previewBanner.subtitle}</p>}
                {previewBanner.cta_text && (
                  <button className="mt-4 rounded-lg bg-white px-6 py-2 font-semibold text-orange-600">{previewBanner.cta_text}</button>
                )}
              </div>
            </div>
            <div className="bg-card p-3 text-center">
              <Button variant="ghost" onClick={() => setPreviewBanner(null)}>Fechar preview</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-8" onClick={() => setEditing(null)}>
          <div className="w-full max-w-2xl rounded-xl bg-card border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
              <h2 className="font-display text-lg font-bold text-foreground">
                {editing.id ? 'Editar Banner' : 'Novo Banner'}
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Título principal</Label>
                  <Input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Subtítulo</Label>
                  <Textarea value={editing.subtitle} onChange={e => setEditing({ ...editing, subtitle: e.target.value })} rows={2} />
                </div>
                <div>
                  <Label>Texto do botão (CTA)</Label>
                  <Input value={editing.cta_text} onChange={e => setEditing({ ...editing, cta_text: e.target.value })} />
                </div>
                <div>
                  <Label>Link do botão</Label>
                  <Input value={editing.cta_link} onChange={e => setEditing({ ...editing, cta_link: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>Imagem de fundo</Label>
                <ImageUploadField
                  value={editing.image_url || ''}
                  onChange={url => setEditing({ ...editing, image_url: url })}
                  bucket="service-images"
                  folder="hero-banners"
                  label=""
                  placeholder="URL da imagem ou faça upload"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Opacidade do overlay ({Math.round(editing.overlay_opacity * 100)}%)</Label>
                  <Slider
                    value={[editing.overlay_opacity * 100]}
                    onValueChange={([v]) => setEditing({ ...editing, overlay_opacity: v / 100 })}
                    min={0} max={100} step={5}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Alinhamento do texto</Label>
                  <Select value={editing.text_alignment} onValueChange={v => setEditing({ ...editing, text_alignment: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Esquerda</SelectItem>
                      <SelectItem value="center">Centro</SelectItem>
                      <SelectItem value="right">Direita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Animação</Label>
                  <Select value={editing.animation_type} onValueChange={v => setEditing({ ...editing, animation_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fade">Fade</SelectItem>
                      <SelectItem value="slide-up">Deslizar</SelectItem>
                      <SelectItem value="none">Nenhuma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Duração (ms)</Label>
                  <Input type="number" value={editing.animation_duration} onChange={e => setEditing({ ...editing, animation_duration: Math.min(Number(e.target.value), 2000) })} min={0} max={2000} />
                </div>
                <div>
                  <Label>Delay (ms)</Label>
                  <Input type="number" value={editing.animation_delay} onChange={e => setEditing({ ...editing, animation_delay: Math.min(Number(e.target.value), 1000) })} min={0} max={1000} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Data de início</Label>
                  <Input type="datetime-local" value={editing.start_date?.slice(0, 16) || ''} onChange={e => setEditing({ ...editing, start_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                </div>
                <div>
                  <Label>Data de expiração</Label>
                  <Input type="datetime-local" value={editing.end_date?.slice(0, 16) || ''} onChange={e => setEditing({ ...editing, end_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Dispositivo alvo</Label>
                  <Select value={editing.target_device} onValueChange={v => setEditing({ ...editing, target_device: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="mobile">Mobile</SelectItem>
                      <SelectItem value="desktop">Desktop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cidade (opcional)</Label>
                  <Input value={editing.target_city || ''} onChange={e => setEditing({ ...editing, target_city: e.target.value || null })} placeholder="Ex: São Paulo" />
                </div>
                <div>
                  <Label>Estado (opcional)</Label>
                  <Input value={editing.target_state || ''} onChange={e => setEditing({ ...editing, target_state: e.target.value || null })} placeholder="Ex: SP" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={editing.active} onCheckedChange={v => setEditing({ ...editing, active: v })} />
                <Label>Banner ativo</Label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button variant="accent" onClick={handleSave} disabled={saving}>
                  <Save className="mr-1 h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminHeroBannersPage;

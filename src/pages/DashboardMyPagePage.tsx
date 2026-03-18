import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowUp, ArrowDown, ExternalLink, Upload, X, Instagram, Facebook, Youtube, Palette, Eye } from 'lucide-react';
import ThemePreview from '@/components/dashboard/ThemePreview';

const THEMES = [
  {
    id: 'default',
    label: 'Padrão',
    description: 'Layout padrão com Plus Jakarta Sans',
    preview: 'bg-card border-border',
    font: 'Plus Jakarta Sans',
  },
  {
    id: 'moderno',
    label: 'Moderno',
    description: 'Space Grotesk + DM Sans, gradientes suaves e sombras',
    preview: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200',
    font: 'Space Grotesk',
  },
  {
    id: 'classico',
    label: 'Clássico',
    description: 'Playfair Display + DM Sans, visual elegante e formal',
    preview: 'bg-amber-50/50 border-amber-300',
    font: 'Playfair Display',
  },
  {
    id: 'minimalista',
    label: 'Minimalista',
    description: 'Space Grotesk light, sem bordas, ultra-limpo',
    preview: 'bg-white border-gray-100',
    font: 'Space Grotesk',
  },
];

const ACCENT_COLORS = [
  { label: 'Padrão', value: '' },
  { label: 'Azul', value: '217 91% 50%' },
  { label: 'Verde', value: '142 71% 45%' },
  { label: 'Roxo', value: '262 83% 58%' },
  { label: 'Laranja', value: '25 95% 53%' },
  { label: 'Rosa', value: '330 81% 60%' },
  { label: 'Turquesa', value: '174 72% 40%' },
  { label: 'Vermelho', value: '0 72% 51%' },
  { label: 'Dourado', value: '45 93% 47%' },
];

const ALL_SECTIONS = [
  { id: 'about', label: 'Sobre o profissional' },
  { id: 'portfolio', label: 'Portfólio' },
  { id: 'services', label: 'Serviços' },
  { id: 'reviews', label: 'Avaliações' },
  { id: 'lead_form', label: 'Formulário de orçamento' },
];

const DashboardMyPagePage = () => {
  const { provider, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [sectionsOrder, setSectionsOrder] = useState<string[]>(['about', 'portfolio', 'services', 'reviews', 'lead_form']);
  const [hiddenSections, setHiddenSections] = useState<string[]>([]);
  const [headline, setHeadline] = useState('');
  const [tagline, setTagline] = useState('');
  const [ctaText, setCtaText] = useState('Solicitar Orçamento');
  const [ctaWhatsappText, setCtaWhatsappText] = useState('Chamar no WhatsApp');
  const [accentColor, setAccentColor] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [theme, setTheme] = useState('default');
  const [existsInDb, setExistsInDb] = useState(false);

  useEffect(() => {
    if (!provider) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('provider_page_settings')
        .select('*')
        .eq('provider_id', provider.id)
        .maybeSingle();
      if (data) {
        setExistsInDb(true);
        setSectionsOrder((data.sections_order as string[]) || ['about', 'portfolio', 'services', 'reviews', 'lead_form']);
        setHiddenSections((data.hidden_sections as string[]) || []);
        setHeadline(data.headline || '');
        setTagline(data.tagline || '');
        setCtaText(data.cta_text || 'Solicitar Orçamento');
        setCtaWhatsappText(data.cta_whatsapp_text || 'Chamar no WhatsApp');
        setAccentColor(data.accent_color || '');
        setCoverImageUrl(data.cover_image_url || '');
        setInstagramUrl(data.instagram_url || '');
        setFacebookUrl(data.facebook_url || '');
        setYoutubeUrl(data.youtube_url || '');
        setTiktokUrl(data.tiktok_url || '');
        setTheme((data as any).theme || 'default');
      }
      setLoading(false);
    };
    fetch();
  }, [provider]);

  const handleSave = async () => {
    if (!provider) return;
    setSaving(true);
    const payload = {
      provider_id: provider.id,
      sections_order: sectionsOrder,
      hidden_sections: hiddenSections,
      headline,
      tagline,
      cta_text: ctaText,
      cta_whatsapp_text: ctaWhatsappText,
      accent_color: accentColor,
      cover_image_url: coverImageUrl,
      instagram_url: instagramUrl,
      facebook_url: facebookUrl,
      youtube_url: youtubeUrl,
      tiktok_url: tiktokUrl,
      theme,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existsInDb) {
      ({ error } = await supabase
        .from('provider_page_settings')
        .update(payload)
        .eq('provider_id', provider.id));
    } else {
      ({ error } = await supabase
        .from('provider_page_settings')
        .insert(payload));
      if (!error) setExistsInDb(true);
    }

    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar configurações');
      console.error(error);
    } else {
      toast.success('Configurações salvas!');
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !provider) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `covers/${provider.user_id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('portfolio').upload(path, file, { upsert: true });
    if (error) {
      toast.error('Erro ao enviar imagem');
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(path);
    setCoverImageUrl(publicUrl);
    setUploading(false);
    toast.success('Imagem de capa enviada!');
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...sectionsOrder];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    [newOrder[index], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[index]];
    setSectionsOrder(newOrder);
  };

  const toggleSection = (sectionId: string) => {
    setHiddenSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(s => s !== sectionId)
        : [...prev, sectionId]
    );
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!provider) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Você precisa criar um perfil de prestador antes de personalizar sua página.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground">Minha Página</h1>
          <div className="flex gap-2">
            {provider.slug && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/profissional/${provider.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" /> Ver página
                </a>
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

        {/* Live Preview */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2"><Eye className="h-4 w-4" /> Pré-visualização</h2>
          <p className="text-xs text-muted-foreground">Veja como sua página ficará em tempo real.</p>
          <ThemePreview
            theme={theme}
            accentColor={accentColor}
            headline={headline}
            tagline={tagline}
            ctaText={ctaText}
            ctaWhatsappText={ctaWhatsappText}
            coverImageUrl={coverImageUrl}
          />
        </section>

        {/* Theme Selector */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2"><Palette className="h-4 w-4" /> Tema da Página</h2>
          <p className="text-xs text-muted-foreground">Cada tema inclui fontes, estilos de botões e layouts únicos.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`text-left rounded-xl border-2 p-4 transition-all ${theme === t.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/30'}`}
              >
                <div className={`h-12 rounded-lg border ${t.preview} mb-2 flex items-center justify-center`}>
                  <span className="text-[10px] text-muted-foreground" style={{ fontFamily: t.font }}>{t.font}</span>
                </div>
                <span className="text-sm font-semibold text-foreground">{t.label}</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Cover Image */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold text-foreground">Imagem de Capa</h2>
          {coverImageUrl ? (
            <div className="relative aspect-[16/5] overflow-hidden rounded-lg border border-border">
              <img src={coverImageUrl} alt="Capa" className="h-full w-full object-cover" />
              <button
                onClick={() => setCoverImageUrl('')}
                className="absolute top-2 right-2 rounded-full bg-background/80 p-1 hover:bg-background"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-muted-foreground hover:border-primary/50 transition-colors">
              <Upload className="h-8 w-8" />
              <span className="text-sm">{uploading ? 'Enviando...' : 'Clique para enviar imagem de capa'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={uploading} />
            </label>
          )}
        </section>

        {/* Headline & Tagline */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Textos de Destaque</h2>
          <div className="space-y-2">
            <Label htmlFor="headline">Headline (frase principal)</Label>
            <Input id="headline" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Ex: Eletricista profissional com 10 anos de experiência" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline (subtítulo)</Label>
            <Input id="tagline" value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Ex: Atendimento rápido e garantia de qualidade" />
          </div>
        </section>

        {/* CTA Texts */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Textos dos Botões</h2>
          <div className="space-y-2">
            <Label htmlFor="ctaText">Botão de orçamento</Label>
            <Input id="ctaText" value={ctaText} onChange={e => setCtaText(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ctaWhatsapp">Botão do WhatsApp</Label>
            <Input id="ctaWhatsapp" value={ctaWhatsappText} onChange={e => setCtaWhatsappText(e.target.value)} />
          </div>
        </section>

        {/* Social Media */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Redes Sociais</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5"><Instagram className="h-4 w-4" /> Instagram</Label>
              <Input value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." />
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5"><Facebook className="h-4 w-4" /> Facebook</Label>
              <Input value={facebookUrl} onChange={e => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/..." />
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5"><Youtube className="h-4 w-4" /> YouTube</Label>
              <Input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/..." />
            </div>
            <div className="space-y-1">
              <Label>🎵 TikTok</Label>
              <Input value={tiktokUrl} onChange={e => setTiktokUrl(e.target.value)} placeholder="https://tiktok.com/..." />
            </div>
          </div>
        </section>

        {/* Accent Color */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold text-foreground">Cor de Destaque</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {ACCENT_COLORS.map(c => (
              <button
                key={c.label}
                onClick={() => setAccentColor(c.value)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-colors ${accentColor === c.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
              >
                <div
                  className="h-8 w-8 rounded-full border border-border"
                  style={{ backgroundColor: c.value ? `hsl(${c.value})` : 'hsl(var(--accent))' }}
                />
                <span className="text-[11px] text-muted-foreground">{c.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Sections Order */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold text-foreground">Ordem das Seções</h2>
          <p className="text-xs text-muted-foreground">Reordene e escolha quais seções aparecem na sua página.</p>
          <div className="space-y-2">
            {sectionsOrder.map((sectionId, index) => {
              const section = ALL_SECTIONS.find(s => s.id === sectionId);
              if (!section) return null;
              const isHidden = hiddenSections.includes(sectionId);
              return (
                <div key={sectionId} className={`flex items-center gap-3 rounded-lg border border-border p-3 transition-opacity ${isHidden ? 'opacity-50' : ''}`}>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveSection(index, 'up')} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => moveSection(index, 'down')} disabled={index === sectionsOrder.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="flex-1 text-sm font-medium text-foreground">{section.label}</span>
                  <Switch checked={!isHidden} onCheckedChange={() => toggleSection(sectionId)} />
                </div>
              );
            })}
          </div>
        </section>

        {/* Save button bottom */}
        <div className="flex justify-end pb-8">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardMyPagePage;

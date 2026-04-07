import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LayoutList, Save, Eye, EyeOff, GripVertical, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DEFAULT_ORDER = 'urgency,sponsor_top,highlights,stats,categories,pwa,dynamic,ad1,featured,popular,ad2,jobs,blog,cities,cta,showcase,sponsors,howitworks,searches,testimonials,faq,sponsor_cta';

const SECTION_LABELS: Record<string, string> = {
  urgency: '🔴 Banner de Urgência',
  sponsor_top: '📢 Patrocinador Topo',
  highlights: '🎠 Destaques Rotativos',
  stats: '📊 Contador de Estatísticas',
  categories: '📂 Categorias',
  pwa: '📱 Instalar App (PWA)',
  dynamic: '🧩 Blocos Dinâmicos',
  ad1: '📣 Anúncio (entre seções)',
  featured: '⭐ Profissionais em Destaque',
  popular: '🔥 Serviços Populares',
  recent: '🕐 Serviços Recentes',
  ad2: '📣 Anúncio (meio)',
  jobs: '💼 Vagas em Destaque',
  blog: '📰 Blog / Notícias',
  cities: '🏙️ Cidades',
  cta: '🚀 Chamada para Ação (CTA)',
  showcase: '🖼️ Vitrine de Anúncios',
  sponsors: '🤝 Patrocinadores',
  howitworks: '📋 Como Funciona',
  searches: '🔍 Buscas Populares',
  testimonials: '💬 Depoimentos',
  faq: '❓ Perguntas Frequentes',
  sponsor_cta: '📢 CTA Patrocinador (rodapé)',
};

const AdminHomeSectionsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [sections, setSections] = useState<string[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('site_settings' as any).select('key, value').in('key', ['homepage_sections_order', 'homepage_hidden_sections']);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.key] = r.value; });
    const order = (map['homepage_sections_order'] || DEFAULT_ORDER).split(',').map((s: string) => s.trim()).filter(Boolean);
    const hiddenSet = new Set((map['homepage_hidden_sections'] || '').split(',').map((s: string) => s.trim()).filter(Boolean));
    setSections(order);
    setHidden(hiddenSet);
  }, []);

  useEffect(() => { if (isAdmin) fetchSettings(); }, [isAdmin, fetchSettings]);

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const updated = [...sections];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setSections(updated);
    setDirty(true);
  };

  const toggleHidden = (slug: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    const orderValue = sections.join(',');
    const hiddenValue = [...hidden].join(',');

    await Promise.all([
      (supabase.from('site_settings' as any) as any).upsert({ key: 'homepage_sections_order', value: orderValue, label: 'Ordem das seções da home', updated_at: new Date().toISOString() }, { onConflict: 'key' }),
      (supabase.from('site_settings' as any) as any).upsert({ key: 'homepage_hidden_sections', value: hiddenValue, label: 'Seções ocultas da home', updated_at: new Date().toISOString() }, { onConflict: 'key' }),
    ]);

    toast.success('Ordem das seções salva!');
    setDirty(false);
  };

  const handleReset = () => {
    setSections(DEFAULT_ORDER.split(','));
    setHidden(new Set());
    setDirty(true);
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <LayoutList className="h-6 w-6" /> Ordem das Seções — Home
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Reordene e oculte as seções da página inicial</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}><RotateCcw className="mr-1 h-4 w-4" /> Restaurar padrão</Button>
          {dirty && <Button variant="accent" size="sm" onClick={handleSave}><Save className="mr-1 h-4 w-4" /> Salvar</Button>}
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {sections.map((slug, index) => {
          const isHidden = hidden.has(slug);
          return (
            <div key={slug} className={`flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-opacity ${isHidden ? 'opacity-50' : ''}`}>
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-bold text-foreground flex-1">
                {SECTION_LABELS[slug] || slug}
              </span>
              <span className="text-xs text-muted-foreground font-mono">{slug}</span>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => moveSection(index, -1)} disabled={index === 0}>↑</Button>
                <Button variant="ghost" size="sm" onClick={() => moveSection(index, 1)} disabled={index === sections.length - 1}>↓</Button>
                <Button variant="ghost" size="sm" onClick={() => toggleHidden(slug)}>
                  {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
};

export default AdminHomeSectionsPage;

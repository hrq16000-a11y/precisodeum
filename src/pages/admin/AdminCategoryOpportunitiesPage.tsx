import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Sparkles, Users } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CategoryRow { id: string; name: string; slug: string }
interface OpportunityRow {
  id: string;
  category_slug: string;
  enabled: boolean;
  headline: string | null;
  subheadline: string | null;
  body_text: string | null;
  cta_pro_label: string | null;
  cta_sponsor_label: string | null;
  banner_url: string | null;
}

const emptyDraft = {
  enabled: true,
  headline: '',
  subheadline: '',
  body_text: '',
  cta_pro_label: '',
  cta_sponsor_label: '',
  banner_url: '',
};

const AdminCategoryOpportunitiesPage = () => {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string>('');
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [search, setSearch] = useState('');

  const { data: categories = [], isLoading: loadingCats } = useQuery({
    queryKey: ['admin-opportunity-categories'],
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug')
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data || []) as CategoryRow[];
    },
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['admin-category-opportunities'],
    queryFn: async (): Promise<OpportunityRow[]> => {
      const { data, error } = await supabase
        .from('category_opportunities')
        .select('id, category_slug, enabled, headline, subheadline, body_text, cta_pro_label, cta_sponsor_label, banner_url');
      if (error) throw error;
      return (data || []) as OpportunityRow[];
    },
  });

  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ['admin-category-opportunity-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_opportunity_leads')
        .select('id, category_slug, category_name, kind, name, email, phone, city, message, status, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const configBySlug = useMemo(() => {
    const map: Record<string, OpportunityRow> = {};
    opportunities.forEach((o) => { map[o.category_slug] = o; });
    return map;
  }, [opportunities]);

  const filteredCats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories;
  }, [categories, search]);

  const selectCategory = (slug: string) => {
    setSelected(slug);
    const cfg = configBySlug[slug];
    setDraft(cfg
      ? {
          enabled: cfg.enabled,
          headline: cfg.headline || '',
          subheadline: cfg.subheadline || '',
          body_text: cfg.body_text || '',
          cta_pro_label: cfg.cta_pro_label || '',
          cta_sponsor_label: cfg.cta_sponsor_label || '',
          banner_url: cfg.banner_url || '',
        }
      : { ...emptyDraft });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        category_slug: selected,
        enabled: draft.enabled,
        headline: draft.headline.trim() || null,
        subheadline: draft.subheadline.trim() || null,
        body_text: draft.body_text.trim() || null,
        cta_pro_label: draft.cta_pro_label.trim() || null,
        cta_sponsor_label: draft.cta_sponsor_label.trim() || null,
        banner_url: draft.banner_url.trim() || null,
      };
      const { error } = await supabase
        .from('category_opportunities')
        .upsert(payload, { onConflict: 'category_slug' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Oportunidade salva');
      void queryClient.invalidateQueries({ queryKey: ['admin-category-opportunities'] });
      void queryClient.invalidateQueries({ queryKey: ['category-opportunity'] });
    },
    onError: () => toast.error('Não foi possível salvar. Verifique suas permissões.'),
  });

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Oportunidades de Categoria</h1>
          <p className="text-sm text-muted-foreground">
            Ative/desative e personalize as páginas de incentivo das categorias sem prestador.
          </p>
        </div>

        <Tabs defaultValue="config">
          <TabsList>
            <TabsTrigger value="config" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Configuração</TabsTrigger>
            <TabsTrigger value="leads" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Leads ({leads.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="rounded-xl border border-border bg-card p-3">
              <Input
                placeholder="Buscar categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2"
              />
              <div className="max-h-[60vh] space-y-1 overflow-y-auto">
                {loadingCats
                  ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 rounded-md" />)
                  : filteredCats.map((c) => {
                      const cfg = configBySlug[c.slug];
                      return (
                        <button
                          key={c.id}
                          onClick={() => selectCategory(c.slug)}
                          className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                            selected === c.slug ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                          }`}
                        >
                          <span className="truncate">{c.name}</span>
                          {cfg && (
                            <span className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${cfg.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                              {cfg.enabled ? 'ativa' : 'off'}
                            </span>
                          )}
                        </button>
                      );
                    })}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Selecione uma categoria à esquerda para editar.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Oportunidade ativa</p>
                      <p className="text-xs text-muted-foreground">Quando desativada, a página não exibe o bloco de incentivo.</p>
                    </div>
                    <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))} />
                  </div>

                  <div>
                    <Label className="text-xs">Título</Label>
                    <Input value={draft.headline} onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))} maxLength={160} />
                  </div>
                  <div>
                    <Label className="text-xs">Subtítulo</Label>
                    <Textarea rows={2} value={draft.subheadline} onChange={(e) => setDraft((d) => ({ ...d, subheadline: e.target.value }))} maxLength={500} />
                  </div>
                  <div>
                    <Label className="text-xs">Texto de incentivo adicional</Label>
                    <Textarea rows={3} value={draft.body_text} onChange={(e) => setDraft((d) => ({ ...d, body_text: e.target.value }))} maxLength={1000} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">CTA profissional</Label>
                      <Input value={draft.cta_pro_label} onChange={(e) => setDraft((d) => ({ ...d, cta_pro_label: e.target.value }))} maxLength={60} />
                    </div>
                    <div>
                      <Label className="text-xs">CTA patrocinador</Label>
                      <Input value={draft.cta_sponsor_label} onChange={(e) => setDraft((d) => ({ ...d, cta_sponsor_label: e.target.value }))} maxLength={60} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Banner do patrocinador (URL)</Label>
                    <Input value={draft.banner_url} onChange={(e) => setDraft((d) => ({ ...d, banner_url: e.target.value }))} maxLength={500} />
                  </div>

                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-1.5">
                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="leads" className="mt-4">
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              {loadingLeads ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 rounded-md" />)}
                </div>
              ) : leads.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nenhum lead de oportunidade ainda.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="p-2">Data</th>
                      <th className="p-2">Categoria</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Nome</th>
                      <th className="p-2">Contato</th>
                      <th className="p-2">Cidade</th>
                      <th className="p-2">Mensagem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l: any) => (
                      <tr key={l.id} className="border-t border-border">
                        <td className="p-2 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="p-2">{l.category_name || l.category_slug}</td>
                        <td className="p-2">{l.kind === 'sponsor' ? 'Patrocinador' : 'Profissional'}</td>
                        <td className="p-2">{l.name}</td>
                        <td className="p-2 whitespace-nowrap">{l.phone}{l.email ? ` · ${l.email}` : ''}</td>
                        <td className="p-2">{l.city || '—'}</td>
                        <td className="p-2 max-w-[240px] truncate">{l.message || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminCategoryOpportunitiesPage;

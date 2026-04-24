import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RefreshCw, Loader2, Search, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ProviderRow {
  id: string;
  business_name: string | null;
  city: string | null;
  state: string | null;
  meta_title: string | null;
  meta_description: string | null;
}
interface ServiceRow {
  id: string;
  service_name: string | null;
  provider_id: string;
  meta_title: string | null;
  meta_description: string | null;
}

const isEmpty = (v: string | null) => !v || v.trim().length === 0;

const AdminSeoAuditPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  const load = async () => {
    setLoadingData(true);
    const [provRes, svcRes] = await Promise.all([
      supabase.from('providers')
        .select('id, business_name, city, state, meta_title, meta_description')
        .or('meta_title.is.null,meta_description.is.null')
        .limit(500),
      supabase.from('services')
        .select('id, service_name, provider_id, meta_title, meta_description')
        .or('meta_title.is.null,meta_description.is.null')
        .limit(500),
    ]);
    if (provRes.data) setProviders(provRes.data as any);
    if (svcRes.data) setServices(svcRes.data as any);
    setLoadingData(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const reprocessProvider = async (id: string) => {
    setReprocessingId(id);
    // Toca a coluna para acionar o trigger autofill_provider_meta
    const { error } = await supabase
      .from('providers')
      .update({ meta_title: null, meta_description: null })
      .eq('id', id);
    setReprocessingId(null);
    if (error) return toast.error('Erro: ' + error.message);
    toast.success('Reprocessado.');
    setProviders((prev) => prev.filter((p) => p.id !== id));
  };

  const reprocessService = async (id: string) => {
    setReprocessingId(id);
    const { error } = await supabase
      .from('services')
      .update({ meta_title: null, meta_description: null })
      .eq('id', id);
    setReprocessingId(null);
    if (error) return toast.error('Erro: ' + error.message);
    toast.success('Reprocessado.');
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  const reprocessAllProviders = async () => {
    if (!confirm(`Reprocessar ${providers.length} profissionais?`)) return;
    setLoadingData(true);
    const ids = providers.map((p) => p.id);
    const { error } = await supabase
      .from('providers')
      .update({ meta_title: null, meta_description: null })
      .in('id', ids);
    setLoadingData(false);
    if (error) return toast.error('Erro: ' + error.message);
    toast.success('Lote reprocessado.');
    load();
  };

  const reprocessAllServices = async () => {
    if (!confirm(`Reprocessar ${services.length} serviços?`)) return;
    setLoadingData(true);
    const ids = services.map((s) => s.id);
    const { error } = await supabase
      .from('services')
      .update({ meta_title: null, meta_description: null })
      .in('id', ids);
    setLoadingData(false);
    if (error) return toast.error('Erro: ' + error.message);
    toast.success('Lote reprocessado.');
    load();
  };

  if (loading) return <AdminLayout><div className="animate-pulse h-96 bg-muted rounded-2xl" /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Auditoria de SEO</h1>
              <p className="text-sm text-muted-foreground">Profissionais e serviços com meta_title ou meta_description vazios</p>
            </div>
          </div>
          <Button variant="outline" onClick={load} disabled={loadingData} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>

        <Tabs defaultValue="providers">
          <TabsList>
            <TabsTrigger value="providers">Profissionais ({providers.length})</TabsTrigger>
            <TabsTrigger value="services">Serviços ({services.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="providers">
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <CardTitle className="text-base">Pendentes</CardTitle>
                {providers.length > 0 && (
                  <Button size="sm" onClick={reprocessAllProviders} disabled={loadingData}>Reprocessar todos</Button>
                )}
              </CardHeader>
              <CardContent>
                {providers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhum pendente. Tudo certo.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {providers.map((p) => (
                      <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-foreground truncate">{p.business_name || '(sem nome)'}</div>
                          <div className="text-xs text-muted-foreground">{p.city || '—'}{p.state ? `/${p.state}` : ''}</div>
                          <div className="flex gap-1 mt-1">
                            {isEmpty(p.meta_title) && <Badge variant="outline" className="text-[10px]"><AlertCircle className="h-3 w-3 mr-1" />title</Badge>}
                            {isEmpty(p.meta_description) && <Badge variant="outline" className="text-[10px]"><AlertCircle className="h-3 w-3 mr-1" />description</Badge>}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => reprocessProvider(p.id)} disabled={reprocessingId === p.id}>
                          {reprocessingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Reprocessar'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services">
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <CardTitle className="text-base">Pendentes</CardTitle>
                {services.length > 0 && (
                  <Button size="sm" onClick={reprocessAllServices} disabled={loadingData}>Reprocessar todos</Button>
                )}
              </CardHeader>
              <CardContent>
                {services.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhum pendente. Tudo certo.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {services.map((s) => (
                      <li key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-foreground truncate">{s.service_name || '(sem nome)'}</div>
                          <div className="flex gap-1 mt-1">
                            {isEmpty(s.meta_title) && <Badge variant="outline" className="text-[10px]"><AlertCircle className="h-3 w-3 mr-1" />title</Badge>}
                            {isEmpty(s.meta_description) && <Badge variant="outline" className="text-[10px]"><AlertCircle className="h-3 w-3 mr-1" />description</Badge>}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => reprocessService(s.id)} disabled={reprocessingId === s.id}>
                          {reprocessingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Reprocessar'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminSeoAuditPage;

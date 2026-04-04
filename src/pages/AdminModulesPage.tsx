import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';
import { Package, Newspaper, Image as ImageIcon, FileText, Users, Briefcase, Megaphone, ClipboardList, MapPin, HelpCircle, Loader2 } from 'lucide-react';

const MODULE_DEFS = [
  { key: 'module_blog', label: 'Blog / Notícias', description: 'CMS de posts, RSS e conteúdo editorial', icon: Newspaper },
  { key: 'module_media', label: 'Mídia & Arquivos', description: 'Gestão centralizada de imagens e uploads', icon: ImageIcon },
  { key: 'module_leads', label: 'Leads / CRM', description: 'Captação e gestão de leads de clientes', icon: FileText },
  { key: 'module_jobs', label: 'Vagas', description: 'Publicação e gestão de oportunidades de trabalho', icon: ClipboardList },
  { key: 'module_sponsors', label: 'Patrocinadores', description: 'Gestão de anunciantes e campanhas comerciais', icon: Megaphone },
  { key: 'module_reviews', label: 'Avaliações', description: 'Sistema de reviews e notas dos prestadores', icon: Users },
  { key: 'module_community', label: 'Comunidade', description: 'Links e recursos comunitários', icon: Users },
  { key: 'module_geo', label: 'Geolocalização', description: 'Detecção de cidade e clima automáticos', icon: MapPin },
  { key: 'module_faq', label: 'FAQ', description: 'Perguntas frequentes públicas', icon: HelpCircle },
  { key: 'module_pwa', label: 'PWA / App', description: 'Instalação de app e push notifications', icon: Package },
];

const AdminModulesPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [modules, setModules] = useState<Record<string, boolean>>({});
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase.from('site_settings' as any).select('key, value').like('key', 'module_%');
      const map: Record<string, boolean> = {};
      MODULE_DEFS.forEach(m => { map[m.key] = true; }); // default enabled
      (data || []).forEach((s: any) => { map[s.key] = s.value === 'true'; });
      setModules(map);
      setFetching(false);
    })();
  }, [isAdmin]);

  const toggleModule = async (key: string, enabled: boolean) => {
    setSaving(key);
    const { error } = await supabase.from('site_settings' as any).upsert(
      { key, value: String(enabled), label: key.replace('module_', 'Módulo '), description: 'Controle de módulo' } as any,
      { onConflict: 'key' }
    );
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      setModules(prev => ({ ...prev, [key]: enabled }));
      await logAuditAction({ action: 'update', resource_type: 'module', details: { module: key, enabled } });
      toast.success(`Módulo ${enabled ? 'ativado' : 'desativado'}`);
    }
    setSaving(null);
  };

  if (adminLoading || !isAdmin) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Módulos do Sistema</h1>
          <p className="text-sm text-muted-foreground">Ative ou desative módulos sem afetar o sistema principal</p>
        </div>

        {fetching ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando módulos...</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {MODULE_DEFS.map(mod => {
              const enabled = modules[mod.key] !== false;
              const isSaving = saving === mod.key;
              return (
                <Card key={mod.key} className={`transition-opacity ${enabled ? '' : 'opacity-60'}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${enabled ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
                          <mod.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-sm">{mod.label}</CardTitle>
                          <CardDescription className="text-xs">{mod.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                        <Badge variant={enabled ? 'default' : 'secondary'} className="text-[10px]">
                          {enabled ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-mono">{mod.key}</span>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(v) => toggleModule(mod.key, v)}
                        disabled={isSaving}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Como funciona</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>• Módulos desativados não são renderizados na interface pública</p>
            <p>• Dados permanecem preservados no banco de dados</p>
            <p>• Reativar um módulo restaura seu funcionamento imediatamente</p>
            <p>• Nenhuma ação destrutiva é executada ao desativar</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminModulesPage;

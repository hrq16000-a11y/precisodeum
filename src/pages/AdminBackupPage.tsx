import { useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/hooks/useAdmin';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';
import { Download, Database, Loader2, FileJson, FileSpreadsheet, Copy, Code, ChevronDown, ChevronUp } from 'lucide-react';

const MODULE_GROUPS = [
  {
    label: 'Database (Tabelas)',
    modules: [
      { table: 'profiles', label: 'Perfis / Users', icon: '👤' },
      { table: 'user_roles', label: 'Roles (Permissões)', icon: '🔐' },
      { table: 'providers', label: 'Prestadores', icon: '👷' },
      { table: 'services', label: 'Serviços', icon: '🔧' },
      { table: 'service_categories', label: 'Serviço ↔ Categorias', icon: '🏷️' },
      { table: 'service_images', label: 'Imagens de Serviços', icon: '🖼️' },
      { table: 'provider_page_settings', label: 'Config. Página Prestador', icon: '⚙️' },
      { table: 'jobs', label: 'Vagas', icon: '📋' },
      { table: 'blog_posts', label: 'Blog / Notícias', icon: '📰' },
      { table: 'sponsors', label: 'Patrocinadores', icon: '📢' },
      { table: 'sponsor_campaigns', label: 'Campanhas', icon: '🎯' },
      { table: 'sponsor_contacts', label: 'Contatos Sponsor', icon: '📇' },
      { table: 'sponsor_contracts', label: 'Contratos', icon: '📄' },
      { table: 'sponsor_metrics', label: 'Métricas Sponsor', icon: '📈' },
      { table: 'sponsor_notes', label: 'Notas Sponsor', icon: '📝' },
      { table: 'sponsor_notifications', label: 'Notif. Sponsor', icon: '🔔' },
      { table: 'categories', label: 'Categorias', icon: '📂' },
      { table: 'cities', label: 'Cidades', icon: '🏙️' },
      { table: 'neighborhoods', label: 'Bairros', icon: '🏘️' },
      { table: 'reviews', label: 'Avaliações', icon: '⭐' },
      { table: 'leads', label: 'Leads', icon: '📩' },
      { table: 'subscriptions', label: 'Assinaturas', icon: '💳' },
      { table: 'notifications', label: 'Notificações', icon: '🔔' },
      { table: 'faqs', label: 'FAQs', icon: '❓' },
      { table: 'highlights', label: 'Destaques', icon: '✨' },
      { table: 'popular_services', label: 'Serv. Populares', icon: '🔥' },
      { table: 'community_links', label: 'Links Comunidade', icon: '🤝' },
      { table: 'hero_banners', label: 'Hero Banners', icon: '🎨' },
      { table: 'site_settings', label: 'Configurações do Site', icon: '⚙️' },
    ],
  },
  {
    label: 'Anúncios',
    modules: [
      { table: 'ad_slots', label: 'Slots de Anúncios', icon: '📐' },
      { table: 'ad_slot_assignments', label: 'Atribuições de Slots', icon: '🔗' },
    ],
  },
  {
    label: 'Logs & Auditoria',
    modules: [
      { table: 'audit_log', label: 'Trilha de Auditoria', icon: '📜' },
    ],
  },
  {
    label: 'PWA & Push',
    modules: [
      { table: 'pwa_install_settings', label: 'PWA Configurações', icon: '📱' },
      { table: 'pwa_install_events', label: 'PWA Eventos', icon: '📊' },
      { table: 'push_subscriptions', label: 'Push Inscrições', icon: '🔔' },
    ],
  },
];

const ALL_MODULES = MODULE_GROUPS.flatMap(g => g.modules);

type Format = 'csv' | 'json';

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const toCsv = (data: any[]): string => {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  return [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const v = row[h];
        if (v === null || v === undefined) return '';
        const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      }).join(',')
    ),
  ].join('\n');
};

const AdminBackupPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [exporting, setExporting] = useState<string | null>(null);

  const exportModule = async (table: string, label: string, format: Format) => {
    setExporting(table + format);
    try {
      const { data, error } = await supabase.from(table as any).select('*').limit(10000);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.info(`${label}: nenhum registro encontrado`);
        setExporting(null);
        return;
      }
      const date = new Date().toISOString().slice(0, 10);
      if (format === 'json') {
        downloadFile(JSON.stringify(data, null, 2), `${table}_${date}.json`, 'application/json');
      } else {
        downloadFile(toCsv(data), `${table}_${date}.csv`, 'text/csv;charset=utf-8;');
      }
      await logAuditAction({ action: 'export_backup', resource_type: table, details: { format, count: data.length } });
      toast.success(`${label}: ${data.length} registros exportados (${format.toUpperCase()})`);
    } catch (err: any) {
      toast.error(`Erro ao exportar ${label}: ${err.message}`);
    }
    setExporting(null);
  };

  const exportAll = async (format: Format) => {
    setExporting('all' + format);
    const allData: Record<string, any[]> = {};
    for (const mod of ALL_MODULES) {
      const { data } = await supabase.from(mod.table as any).select('*').limit(10000);
      allData[mod.table] = data || [];
    }
    const date = new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      downloadFile(JSON.stringify(allData, null, 2), `backup_completo_${date}.json`, 'application/json');
    } else {
      let combined = '';
      for (const [table, rows] of Object.entries(allData)) {
        if (rows.length === 0) continue;
        combined += `\n--- ${table} (${rows.length} registros) ---\n`;
        combined += toCsv(rows) + '\n';
      }
      downloadFile(combined, `backup_completo_${date}.csv`, 'text/csv;charset=utf-8;');
    }
    await logAuditAction({ action: 'export_backup_full', resource_type: 'system', details: { format, modules: ALL_MODULES.length } });
    toast.success(`Backup completo exportado (${format.toUpperCase()})`);
    setExporting(null);
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="h-6 w-6" /> Backup & Exportação Completa
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Exporte todos os dados do sistema — {ALL_MODULES.length} tabelas disponíveis</p>
        </div>
      </div>

      {/* Full backup */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-lg font-bold text-foreground">Backup Completo</h2>
        <p className="text-sm text-muted-foreground mt-1">Exporta todas as {ALL_MODULES.length} tabelas em um único arquivo</p>
        <div className="mt-4 flex gap-2">
          <Button variant="accent" onClick={() => exportAll('json')} disabled={!!exporting}>
            {exporting === 'alljson' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileJson className="mr-1 h-4 w-4" />}
            Exportar JSON
          </Button>
          <Button variant="outline" onClick={() => exportAll('csv')} disabled={!!exporting}>
            {exporting === 'allcsv' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Grouped per-module export */}
      {MODULE_GROUPS.map(group => (
        <div key={group.label} className="mt-6">
          <h2 className="font-display text-base font-bold text-foreground mb-3">{group.label}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.modules.map(mod => (
              <div key={mod.table} className="rounded-xl border border-border bg-card p-4 shadow-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{mod.icon}</span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{mod.label}</h3>
                    <p className="text-xs text-muted-foreground">{mod.table}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => exportModule(mod.table, mod.label, 'json')} disabled={!!exporting} title="JSON">
                    {exporting === mod.table + 'json' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => exportModule(mod.table, mod.label, 'csv')} disabled={!!exporting} title="CSV">
                    {exporting === mod.table + 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </AdminLayout>
  );
};

export default AdminBackupPage;

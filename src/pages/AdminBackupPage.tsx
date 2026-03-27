import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/hooks/useAdmin';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';
import { Download, Database, Loader2, FileJson, FileSpreadsheet } from 'lucide-react';

const MODULES = [
  { table: 'providers', label: 'Prestadores', icon: '👷' },
  { table: 'services', label: 'Serviços', icon: '🔧' },
  { table: 'jobs', label: 'Vagas', icon: '📋' },
  { table: 'blog_posts', label: 'Blog / Notícias', icon: '📰' },
  { table: 'sponsors', label: 'Patrocinadores', icon: '📢' },
  { table: 'categories', label: 'Categorias', icon: '📂' },
  { table: 'cities', label: 'Cidades', icon: '🏙️' },
  { table: 'reviews', label: 'Avaliações', icon: '⭐' },
  { table: 'leads', label: 'Leads', icon: '📩' },
  { table: 'profiles', label: 'Perfis', icon: '👤' },
  { table: 'faqs', label: 'FAQs', icon: '❓' },
  { table: 'highlights', label: 'Destaques', icon: '✨' },
  { table: 'popular_services', label: 'Serv. Populares', icon: '🔥' },
  { table: 'audit_log', label: 'Trilha de Auditoria', icon: '📜' },
  { table: 'pwa_install_settings', label: 'PWA Configurações', icon: '📱' },
  { table: 'pwa_install_events', label: 'PWA Eventos', icon: '📊' },
  { table: 'push_subscriptions', label: 'Push Inscrições', icon: '🔔' },
] as const;

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
    for (const mod of MODULES) {
      const { data } = await supabase.from(mod.table as any).select('*').limit(10000);
      allData[mod.table] = data || [];
    }
    const date = new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      downloadFile(JSON.stringify(allData, null, 2), `backup_completo_${date}.json`, 'application/json');
    } else {
      // For CSV export all, create one file per table in a combined format
      let combined = '';
      for (const [table, rows] of Object.entries(allData)) {
        if (rows.length === 0) continue;
        combined += `\n--- ${table} (${rows.length} registros) ---\n`;
        combined += toCsv(rows) + '\n';
      }
      downloadFile(combined, `backup_completo_${date}.csv`, 'text/csv;charset=utf-8;');
    }
    await logAuditAction({ action: 'export_backup_full', resource_type: 'system', details: { format, modules: MODULES.length } });
    toast.success(`Backup completo exportado (${format.toUpperCase()})`);
    setExporting(null);
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="h-6 w-6" /> Backup & Exportação
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Exporte dados do sistema por módulo ou backup completo</p>
        </div>
      </div>

      {/* Full backup */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-lg font-bold text-foreground">Backup Completo</h2>
        <p className="text-sm text-muted-foreground mt-1">Exporta todos os módulos em um único arquivo</p>
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

      {/* Per-module export */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map(mod => (
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
    </AdminLayout>
  );
};

export default AdminBackupPage;

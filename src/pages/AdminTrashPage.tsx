import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminBulkActions } from '@/hooks/useAdminBulkActions';
import BulkActionsBar from '@/components/admin/BulkActionsBar';
import SelectionCheckbox from '@/components/admin/SelectionCheckbox';
import { logAuditAction } from '@/hooks/useAuditLog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const TABLES = [
  { key: 'providers', label: 'Prestadores', nameField: 'business_name' },
  { key: 'jobs', label: 'Vagas', nameField: 'title' },
  { key: 'services', label: 'Serviços', nameField: 'service_name' },
  { key: 'blog_posts', label: 'Notícias', nameField: 'title' },
  { key: 'sponsors', label: 'Patrocinadores', nameField: 'title' },
] as const;

const AdminTrashPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [activeTab, setActiveTab] = useState('providers');
  const [items, setItems] = useState<any[]>([]);

  const fetchTrash = async (table: string) => {
    const { data } = await supabase
      .from(table as any)
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    setItems((data as any[]) || []);
  };

  useEffect(() => {
    if (isAdmin) fetchTrash(activeTab);
  }, [isAdmin, activeTab]);

  const handleRestore = async (table: string, id: string) => {
    const { error } = await supabase.from(table as any).update({ deleted_at: null } as any).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Item restaurado!');
    await logAuditAction({ action: 'restore', resource_type: table, resource_id: id });
    fetchTrash(table);
  };

  const handlePermanentDelete = async (table: string, id: string) => {
    const { error } = await supabase.from(table as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Item excluído permanentemente');
    await logAuditAction({ action: 'delete', resource_type: table, resource_id: id });
    fetchTrash(table);
  };

  const bulk = useAdminBulkActions({
    table: activeTab,
    resourceType: activeTab,
    onComplete: () => fetchTrash(activeTab),
  });

  if (loading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  const tableCfg = TABLES.find(t => t.key === activeTab)!;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <Trash2 className="h-6 w-6" /> Lixeira
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Itens removidos que podem ser restaurados</p>

      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); bulk.clearSelection(); }} className="mt-4">
        <TabsList className="flex-wrap">
          {TABLES.map(t => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {TABLES.map(t => (
          <TabsContent key={t.key} value={t.key}>
            {bulk.hasSelection && (
              <div className="mb-3">
                <BulkActionsBar
                  count={bulk.selectionCount}
                  onClear={bulk.clearSelection}
                  onRestore={bulk.bulkRestore}
                  isTrash
                  loading={bulk.bulkLoading}
                />
              </div>
            )}

            {items.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center">
                <p className="text-muted-foreground">Lixeira vazia</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                    <SelectionCheckbox
                      checked={bulk.selectedIds.has(item.id)}
                      onCheckedChange={() => bulk.toggleSelection(item.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item[tableCfg.nameField] || 'Sem nome'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Removido em {new Date(item.deleted_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleRestore(t.key, item.id)} className="text-green-600 border-green-200">
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Exclusão permanente</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. O item será excluído definitivamente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handlePermanentDelete(t.key, item.id)}>
                              Excluir definitivamente
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </AdminLayout>
  );
};

export default AdminTrashPage;

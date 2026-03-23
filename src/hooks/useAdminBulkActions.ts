import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logAuditAction } from './useAuditLog';
import { toast } from 'sonner';

interface BulkConfig {
  table: string;
  resourceType: string;
  onComplete?: () => void;
}

export const useAdminBulkActions = ({ table, resourceType, onComplete }: BulkConfig) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const bulkSoftDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);

    const { error } = await supabase
      .from(table as any)
      .update({ deleted_at: new Date().toISOString() } as any)
      .in('id', ids);

    if (error) {
      toast.error('Erro ao mover para lixeira: ' + error.message);
    } else {
      toast.success(`${ids.length} item(ns) movido(s) para a lixeira`);
      await logAuditAction({
        action: 'bulk_delete',
        resource_type: resourceType,
        details: { ids, count: ids.length },
      });
      clearSelection();
      onComplete?.();
    }
    setBulkLoading(false);
  }, [selectedIds, table, resourceType, onComplete, clearSelection]);

  const bulkRestore = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);

    const { error } = await supabase
      .from(table as any)
      .update({ deleted_at: null } as any)
      .in('id', ids);

    if (error) {
      toast.error('Erro ao restaurar: ' + error.message);
    } else {
      toast.success(`${ids.length} item(ns) restaurado(s)`);
      await logAuditAction({
        action: 'restore',
        resource_type: resourceType,
        details: { ids, count: ids.length },
      });
      clearSelection();
      onComplete?.();
    }
    setBulkLoading(false);
  }, [selectedIds, table, resourceType, onComplete, clearSelection]);

  const bulkUpdate = useCallback(async (updates: Record<string, unknown>) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);

    const { error } = await supabase
      .from(table as any)
      .update(updates as any)
      .in('id', ids);

    if (error) {
      toast.error('Erro ao atualizar: ' + error.message);
    } else {
      toast.success(`${ids.length} item(ns) atualizado(s)`);
      await logAuditAction({
        action: 'bulk_update',
        resource_type: resourceType,
        details: { ids, count: ids.length, updates },
      });
      clearSelection();
      onComplete?.();
    }
    setBulkLoading(false);
  }, [selectedIds, table, resourceType, onComplete, clearSelection]);

  const exportSelected = useCallback((items: any[], filename: string) => {
    const selected = items.filter(item => selectedIds.has(item.id));
    if (selected.length === 0) {
      toast.error('Nenhum item selecionado');
      return;
    }
    const csv = [
      Object.keys(selected[0]).join(','),
      ...selected.map(item =>
        Object.values(item).map(v =>
          typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v ?? '')
        ).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    logAuditAction({
      action: 'export',
      resource_type: resourceType,
      details: { count: selected.length },
    });
    toast.success(`${selected.length} item(ns) exportado(s)`);
  }, [selectedIds, resourceType]);

  return {
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkSoftDelete,
    bulkRestore,
    bulkUpdate,
    exportSelected,
    bulkLoading,
    hasSelection: selectedIds.size > 0,
    selectionCount: selectedIds.size,
  };
};

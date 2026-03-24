import { supabase } from '@/integrations/supabase/client';

type AuditAction = 'create' | 'update' | 'delete' | 'soft_delete' | 'restore' | 'approve' | 'reject' | 'block' | 'unblock' | 'bulk_delete' | 'bulk_update' | 'export' | 'export_backup' | 'export_backup_full';

interface AuditEntry {
  action: AuditAction;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, unknown>;
}

export const logAuditAction = async (entry: AuditEntry) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('audit_log' as any).insert({
      user_id: user.id,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id || null,
      details: entry.details || {},
    } as any);
  } catch (e) {
    console.error('[AuditLog] Failed to log:', e);
  }
};

export const useAuditLog = () => {
  return { logAction: logAuditAction };
};

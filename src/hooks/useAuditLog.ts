import { supabase } from '@/integrations/supabase/client';

type AuditAction = 'create' | 'update' | 'delete' | 'soft_delete' | 'restore' | 'approve' | 'reject' | 'block' | 'unblock' | 'bulk_delete' | 'bulk_update' | 'bulk_active' | 'bulk_inactive' | 'export' | 'export_backup' | 'export_backup_full' | 'export_storage_zip' | 'import_storage_zip' | 'download_storage_selection' | 'duplicate' | 'update_permissions' | 'seed_capitals' | 'bulk_import' | 'user_updated' | 'role_changed' | 'plan_upgraded' | 'plan_downgraded' | 'resource_used' | 'lead_converted' | 'subscription_changed' | 'slot_updated' | 'media_uploaded' | 'media_deleted' | 'subscription_created' | 'batch_optimize' | 'batch_optimize_all' | 'suspend' | 'ban' | 'reactivate' | 'tag_added' | 'tag_removed' | 'restore_service' | 'soft_delete_service' | 'next_step_chosen' | 'next_step_dismissed' | 'profile_view' | 'whatsapp_click' | 'phone_click' | 'level_share' | 'setting_updated' | 'service_update_success' | 'album_update_success' | 'photo_update_success' | 'name_validation_blocked' | 'profile_provider_sync_failed' | 'admin_validation_blocked' | 'bet_onboarding_sync_failed' | 'profile_type_switch_sync_failed' | 'persist_first_service_sync_failed' | 'phase4_sync_failed' | 'avatar_sync_failed' | 'onboarding_progress_sync_failed' | 'contact_ownership_conflict' | 'admin_write_boundary_failed' | 'operation_build_failed' | 'operation_execution_mismatch' | 'operation_execution_failed' | 'atomic_readiness_blocked' | 'unsafe_write_detected' | 'live_execution_blocked' | 'drift_detected' | 'drift_detection_failed' | 'reconciliation_blocked' | 'consistency_snapshot_generated' | 'consistency_risk_detected' | 'consistency_snapshot_failed' | 'write_path_quarantined' | 'unsafe_expansion_detected' | 'architecture_score_generated' | 'runtime_telemetry_generated' | 'operational_risk_detected' | 'atomic_priority_calculated' | 'flow_health_degraded' | 'architectural_invariant_failed' | 'contract_coverage_failed' | 'guarantee_violation_detected' | 'dependency_instability_detected' | 'atomic_blueprint_generated' | 'migration_stage_blocked' | 'rollback_strategy_missing' | 'topology_risk_detected' | 'atomic_feasibility_changed' | 'atomic_simulation_generated' | 'divergence_detected' | 'parity_regression_detected' | 'rollback_simulation_failed' | 'blast_radius_changed' | 'migration_confidence_changed';

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

import { supabase } from '@/integrations/supabase/client';

type AuditAction = 'create' | 'update' | 'delete' | 'soft_delete' | 'restore' | 'approve' | 'reject' | 'block' | 'unblock' | 'bulk_delete' | 'bulk_update' | 'bulk_active' | 'bulk_inactive' | 'export' | 'export_backup' | 'export_backup_full' | 'export_storage_zip' | 'import_storage_zip' | 'download_storage_selection' | 'duplicate' | 'update_permissions' | 'seed_capitals' | 'bulk_import' | 'user_updated' | 'role_changed' | 'plan_upgraded' | 'plan_downgraded' | 'resource_used' | 'lead_converted' | 'subscription_changed' | 'slot_updated' | 'media_uploaded' | 'media_deleted' | 'subscription_created' | 'batch_optimize' | 'batch_optimize_all' | 'suspend' | 'ban' | 'reactivate' | 'tag_added' | 'tag_removed' | 'restore_service' | 'soft_delete_service' | 'next_step_chosen' | 'next_step_dismissed' | 'profile_view' | 'whatsapp_click' | 'phone_click' | 'level_share' | 'setting_updated' | 'service_update_success' | 'album_update_success' | 'photo_update_success' | 'name_validation_blocked' | 'profile_provider_sync_failed' | 'admin_validation_blocked' | 'bet_onboarding_sync_failed' | 'profile_type_switch_sync_failed' | 'persist_first_service_sync_failed' | 'phase4_sync_failed' | 'avatar_sync_failed' | 'onboarding_progress_sync_failed' | 'contact_ownership_conflict' | 'admin_write_boundary_failed' | 'operation_build_failed' | 'operation_execution_mismatch' | 'operation_execution_failed' | 'atomic_readiness_blocked' | 'unsafe_write_detected' | 'live_execution_blocked' | 'drift_detected' | 'drift_detection_failed' | 'reconciliation_blocked' | 'consistency_snapshot_generated' | 'consistency_risk_detected' | 'consistency_snapshot_failed' | 'write_path_quarantined' | 'unsafe_expansion_detected' | 'architecture_score_generated' | 'runtime_telemetry_generated' | 'operational_risk_detected' | 'atomic_priority_calculated' | 'flow_health_degraded' | 'architectural_invariant_failed' | 'contract_coverage_failed' | 'guarantee_violation_detected' | 'dependency_instability_detected' | 'atomic_blueprint_generated' | 'migration_stage_blocked' | 'rollback_strategy_missing' | 'topology_risk_detected' | 'atomic_feasibility_changed' | 'atomic_simulation_generated' | 'divergence_detected' | 'parity_regression_detected' | 'rollback_simulation_failed' | 'blast_radius_changed' | 'migration_confidence_changed' | 'atomic_promotion_evaluated' | 'promotion_blocked' | 'promotion_candidate_ranked' | 'unsafe_stage_transition_detected' | 'promotion_confidence_changed' | 'rpc_contract_generated' | 'rpc_contract_blocked' | 'rpc_readiness_changed' | 'rpc_payload_risk_detected' | 'rpc_rollback_incompatible' | 'rpc_idempotency_risk_detected' | 'atomic_pilot_candidate_detected' | 'pilot_rollout_blocked' | 'pilot_abort_strategy_generated' | 'kill_switch_trigger_detected' | 'pilot_readiness_changed' | 'unsafe_pilot_candidate_detected' | 'governance_matrix_generated' | 'governance_risk_detected' | 'release_freeze_detected' | 'unsafe_governance_promotion_detected' | 'governance_approval_required' | 'rollback_authority_mismatch' | 'runtime_certification_generated' | 'runtime_certification_failed' | 'runtime_certification_risk_detected' | 'parity_certification_changed' | 'rollback_certification_blocked' | 'observability_certification_gap' | 'drift_certification_degraded' | 'runtime_trace_recorded' | 'runtime_trace_failed' | 'runtime_trace_divergence_detected' | 'runtime_ordering_violation_detected' | 'runtime_trace_classified' | 'runtime_trace_parity_gap_detected' | 'runtime_history_generated' | 'runtime_history_regression_detected' | 'runtime_lineage_broken' | 'runtime_propagation_risk_detected' | 'temporal_consistency_degraded' | 'runtime_trend_changed' | 'historical_parity_gap_detected' | 'runtime_replay_generated' | 'replay_divergence_detected' | 'replay_ordering_regression_detected' | 'replay_lineage_broken' | 'replay_propagation_risk_detected' | 'replay_parity_degraded' | 'runtime_causality_generated' | 'runtime_causality_escalated' | 'hidden_dependency_cascade_detected' | 'recursive_causality_detected' | 'circular_causality_detected' | 'propagation_depth_increased' | 'replay_causality_regressed' | 'runtime_stability_generated' | 'dependency_resolution_failed' | 'collapse_risk_detected' | 'convergence_regressed' | 'propagation_envelope_overflow' | 'isolation_boundary_leaked' | 'runtime_divergence_detected';

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

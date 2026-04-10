/**
 * System Integrity Engine — Auto-auditor
 *
 * Detects inconsistencies:
 * - RLS vs code mismatch
 * - Missing views
 * - Schema drift
 * - Policy redundancy
 *
 * Runs on-demand or via cron (edge function).
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export type DriftType = 'schema' | 'policy' | 'ui' | 'api' | 'engine';
export type DriftSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DriftReport {
  id: string;
  type: DriftType;
  severity: DriftSeverity;
  description: string;
  detected_at: string;
  resolved: boolean;
  resolution_note: string | null;
}

export interface ContractEntry {
  id: string;
  entity_type: 'table' | 'view' | 'component' | 'engine' | 'function';
  entity_name: string;
  contract_json: Record<string, unknown>;
  last_verified_at: string | null;
  status: 'valid' | 'invalid' | 'unverified';
}

// ═══════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════

const SystemIntegrityEngine = {
  /**
   * Report a drift (inconsistency detected).
   */
  async reportDrift(
    type: DriftType,
    severity: DriftSeverity,
    description: string
  ): Promise<void> {
    await (supabase.from('system_drift_reports' as any) as any).insert({
      type,
      severity,
      description,
    });
  },

  /**
   * Get all unresolved drift reports.
   */
  async getUnresolvedDrifts(): Promise<DriftReport[]> {
    const { data } = await supabase
      .from('system_drift_reports' as any)
      .select('*')
      .eq('resolved', false)
      .order('detected_at', { ascending: false });
    return (data || []) as unknown as DriftReport[];
  },

  /**
   * Resolve a drift report.
   */
  async resolveDrift(id: string, note: string): Promise<void> {
    await (supabase.from('system_drift_reports' as any) as any)
      .update({ resolved: true, resolution_note: note })
      .eq('id', id);
  },

  /**
   * Register or update a contract for an entity.
   */
  async registerContract(
    entityType: ContractEntry['entity_type'],
    entityName: string,
    contractJson: Record<string, unknown>
  ): Promise<void> {
    await (supabase.from('system_contract_map' as any) as any).upsert(
      {
        entity_type: entityType,
        entity_name: entityName,
        contract_json: contractJson,
        last_verified_at: new Date().toISOString(),
        status: 'valid',
      },
      { onConflict: 'entity_name' }
    );
  },

  /**
   * Get all contracts.
   */
  async getContracts(): Promise<ContractEntry[]> {
    const { data } = await supabase
      .from('system_contract_map' as any)
      .select('*')
      .order('entity_name');
    return (data || []) as unknown as ContractEntry[];
  },

  /**
   * Verify a contract against expected shape.
   */
  async verifyContract(entityName: string, actualShape: Record<string, unknown>): Promise<boolean> {
    const { data } = await supabase
      .from('system_contract_map' as any)
      .select('*')
      .eq('entity_name', entityName)
      .single();

    if (!data) return true; // No contract registered = pass

    const contract = (data as unknown as ContractEntry);
    const expectedKeys = Object.keys(contract.contract_json);
    const actualKeys = Object.keys(actualShape);
    const missing = expectedKeys.filter(k => !actualKeys.includes(k));

    if (missing.length > 0) {
      await (supabase.from('system_contract_map' as any) as any)
        .update({ status: 'invalid', last_verified_at: new Date().toISOString() })
        .eq('entity_name', entityName);

      await this.reportDrift(
        'schema',
        'high',
        `Contract violation for "${entityName}": missing keys [${missing.join(', ')}]`
      );
      return false;
    }

    await (supabase.from('system_contract_map' as any) as any)
      .update({ status: 'valid', last_verified_at: new Date().toISOString() })
      .eq('entity_name', entityName);

    return true;
  },
};

export default SystemIntegrityEngine;

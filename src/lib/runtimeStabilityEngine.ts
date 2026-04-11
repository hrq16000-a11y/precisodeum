/**
 * Runtime Stability Engine
 *
 * Prevents: blank screens, lazy crashes, import failures, silent component errors.
 * Tracks component health and manages fallback strategies.
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export type ComponentStatus = 'healthy' | 'degraded' | 'failing';
export type FallbackType = 'skeleton' | 'retry' | 'redirect' | 'null_safe' | 'error_boundary';

export interface ComponentHealth {
  id: string;
  component_name: string;
  failure_count: number;
  last_error: string | null;
  status: ComponentStatus;
  last_checked_at: string;
}

export interface FallbackEntry {
  id: string;
  component: string;
  fallback_type: FallbackType;
  strategy_json: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════
// In-memory buffer (batch writes to avoid flooding DB)
// ═══════════════════════════════════════════════════════════════════════

const _errorBuffer: Map<string, { count: number; lastError: string }> = new Map();
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 10_000; // 10 seconds

async function flushErrors() {
  if (_errorBuffer.size === 0) return;

  const entries = Array.from(_errorBuffer.entries());
  _errorBuffer.clear();

  for (const [componentName, { count, lastError }] of entries) {
    const status: ComponentStatus = count >= 5 ? 'failing' : count >= 2 ? 'degraded' : 'healthy';

    const { error } = await (supabase.from('runtime_component_health' as any) as any).upsert(
      {
        component_name: componentName,
        failure_count: count,
        last_error: lastError,
        status,
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: 'component_name' }
    );
    // Graceful: if RLS blocks non-admin writes, just skip silently
    if (error) {
      console.debug(`[RuntimeStability] Flush skipped for "${componentName}": ${error.message}`);
    }
  }
}

function scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flushErrors().catch(console.error);
  }, FLUSH_INTERVAL);
}

// ═══════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════

const RuntimeStabilityEngine = {
  /**
   * Report a component error. Buffered and flushed every 10s.
   */
  reportError(componentName: string, error: Error | string) {
    const errorMsg = typeof error === 'string' ? error : error.message;
    const existing = _errorBuffer.get(componentName);

    _errorBuffer.set(componentName, {
      count: (existing?.count ?? 0) + 1,
      lastError: errorMsg,
    });

    scheduleFlush();
    console.warn(`[RuntimeStability] Error in "${componentName}":`, errorMsg);
  },

  /**
   * Get health status of all tracked components.
   */
  async getHealthReport(): Promise<ComponentHealth[]> {
    const { data } = await supabase
      .from('runtime_component_health' as any)
      .select('*')
      .order('status', { ascending: true });
    return (data || []) as unknown as ComponentHealth[];
  },

  /**
   * Get failing components only.
   */
  async getFailingComponents(): Promise<ComponentHealth[]> {
    const { data } = await supabase
      .from('runtime_component_health' as any)
      .select('*')
      .neq('status', 'healthy')
      .order('failure_count', { ascending: false });
    return (data || []) as unknown as ComponentHealth[];
  },

  /**
   * Get fallback strategy for a component.
   */
  async getFallback(componentName: string): Promise<FallbackEntry | null> {
    const { data } = await supabase
      .from('runtime_fallback_registry' as any)
      .select('*')
      .eq('component', componentName)
      .single();
    return (data as unknown as FallbackEntry) ?? null;
  },

  /**
   * Register a fallback for a component.
   */
  async registerFallback(
    componentName: string,
    fallbackType: FallbackType,
    strategy: Record<string, unknown> = {}
  ): Promise<void> {
    await (supabase.from('runtime_fallback_registry' as any) as any).upsert(
      {
        component: componentName,
        fallback_type: fallbackType,
        strategy_json: strategy,
      },
      { onConflict: 'component' }
    );
  },

  /**
   * Reset health status for a component.
   */
  async resetHealth(componentName: string): Promise<void> {
    await (supabase.from('runtime_component_health' as any) as any)
      .update({ failure_count: 0, status: 'healthy', last_error: null, last_checked_at: new Date().toISOString() })
      .eq('component_name', componentName);
  },

  /**
   * Force flush buffered errors immediately.
   */
  async flush() {
    if (_flushTimer) {
      clearTimeout(_flushTimer);
      _flushTimer = null;
    }
    await flushErrors();
  },
};

export default RuntimeStabilityEngine;

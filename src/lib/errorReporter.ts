/**
 * Global Error Reporter
 * Captures errors with context, action history, and reports to error_reports table.
 */

import { supabase } from '@/integrations/supabase/client';

// Action history buffer (last 20 actions)
const actionHistory: Array<{ action: string; timestamp: string; detail?: string }> = [];
const MAX_HISTORY = 20;

export function trackAction(action: string, detail?: string) {
  actionHistory.push({
    action,
    timestamp: new Date().toISOString(),
    detail,
  });
  if (actionHistory.length > MAX_HISTORY) actionHistory.shift();
}

export function getActionHistory() {
  return [...actionHistory];
}

interface ReportErrorOptions {
  errorMessage: string;
  errorStack?: string;
  componentName?: string;
  actionContext: string;
  severity?: 'warning' | 'error' | 'critical';
}

export async function reportError(opts: ReportErrorOptions): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const viewport = `${window.innerWidth}x${window.innerHeight}`;
    const pagePath = window.location.pathname + window.location.search;

    const { data, error } = await supabase
      .from('error_reports' as any)
      .insert({
        user_id: user.id,
        page_path: pagePath,
        action_context: opts.actionContext,
        error_message: opts.errorMessage,
        error_stack: opts.errorStack || null,
        component_name: opts.componentName || null,
        user_agent: navigator.userAgent,
        viewport,
        action_history: getActionHistory(),
        severity: opts.severity || 'error',
      } as any)
      .select('id')
      .single();

    if (error) {
      console.debug('[ErrorReporter] Failed to report:', error.message);
      return null;
    }
    return (data as any)?.id || null;
  } catch (e) {
    console.debug('[ErrorReporter] Exception:', e);
    return null;
  }
}

// Wrap an async save operation with error reporting
export async function safeSave<T>(
  actionContext: string,
  componentName: string,
  fn: () => Promise<T>,
): Promise<{ success: true; result: T } | { success: false; reportId: string | null; error: Error }> {
  trackAction('save_attempt', actionContext);
  try {
    const result = await fn();
    trackAction('save_success', actionContext);
    return { success: true, result };
  } catch (err: any) {
    trackAction('save_failed', `${actionContext}: ${err.message}`);
    const reportId = await reportError({
      errorMessage: err.message || 'Erro desconhecido',
      errorStack: err.stack,
      componentName,
      actionContext,
      severity: 'error',
    });
    return { success: false, reportId, error: err };
  }
}

// Get unresolved error count for admin badge
export async function getUnresolvedErrorCount(): Promise<number> {
  try {
    const { count } = await supabase
      .from('error_reports' as any)
      .select('id', { count: 'exact', head: true })
      .eq('resolved', false);
    return count || 0;
  } catch {
    return 0;
  }
}

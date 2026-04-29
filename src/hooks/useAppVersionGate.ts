import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { APP_VERSION, compareVersions } from '@/lib/appVersion';

export type VersionGateStatus = 'ok' | 'suggest' | 'force';

export interface VersionGateState {
  status: VersionGateStatus;
  currentVersion: string;
  minVersion: string;
  latestVersion: string;
  forceMessage: string;
  suggestMessage: string;
  loading: boolean;
}

const INITIAL: VersionGateState = {
  status: 'ok',
  currentVersion: APP_VERSION,
  minVersion: '0.0.0',
  latestVersion: '0.0.0',
  forceMessage: '',
  suggestMessage: '',
  loading: true,
};

const RECHECK_MS = 10 * 60 * 1000; // 10 min

/**
 * Consulta a configuração de versão remota (RPC `get_app_version_config`)
 * e retorna o status:
 *  - 'force'   → APP_VERSION < min_version    → modal obrigatório
 *  - 'suggest' → APP_VERSION < latest_version → banner não-obstrutivo
 *  - 'ok'      → versão atual ou superior
 */
export function useAppVersionGate() {
  const [state, setState] = useState<VersionGateState>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const { data, error } = await supabase.rpc('get_app_version_config' as any);
        if (cancelled || error || !data) {
          setState((s) => ({ ...s, loading: false }));
          return;
        }
        const cfg = data as {
          min_version?: string;
          latest_version?: string;
          force_message?: string;
          suggest_message?: string;
        };
        const min = cfg.min_version || '0.0.0';
        const latest = cfg.latest_version || '0.0.0';

        let status: VersionGateStatus = 'ok';
        if (compareVersions(APP_VERSION, min) < 0) status = 'force';
        else if (compareVersions(APP_VERSION, latest) < 0) status = 'suggest';

        setState({
          status,
          currentVersion: APP_VERSION,
          minVersion: min,
          latestVersion: latest,
          forceMessage: cfg.force_message || '',
          suggestMessage: cfg.suggest_message || '',
          loading: false,
        });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      }
    };

    void check();
    const interval = setInterval(check, RECHECK_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return state;
}

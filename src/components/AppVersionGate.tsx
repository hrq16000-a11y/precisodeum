import { useEffect, useState } from 'react';
import { AlertTriangle, Download, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppVersionGate } from '@/hooks/useAppVersionGate';
import {
  forceClientUpdate,
  getForceUpdateStats,
  hasExceededForceUpdateAttempts,
  markForceUpdateSuccess,
  resetForceUpdateAttempts,
} from '@/lib/forceClientUpdate';

const DISMISS_KEY = 'app_update_suggest_dismissed_v';
// Flag local para evitar loops de reload caso algo dê errado.
const AUTO_RELOAD_GUARD_KEY = 'app_auto_force_reload_done_v';

const purgeAndReload = () => { void forceClientUpdate(); };

/**
 * Gate global de versão do app:
 *  - status = 'force'   → modal full-screen bloqueante
 *  - status = 'suggest' → banner topo dispensável
 *  - status = 'ok'      → não renderiza nada
 *
 * Configurado via `site_settings`:
 *  - app_min_version, app_latest_version, app_update_force_message, app_update_suggest_message
 */
const AppVersionGate = () => {
  const gate = useAppVersionGate();
  const [autoUpdateBlocked, setAutoUpdateBlocked] = useState(false);
  const [dismissedFor, setDismissedFor] = useState<string | null>(() => {
    try { return localStorage.getItem(DISMISS_KEY); } catch { return null; }
  });

  useEffect(() => {
    if (gate.loading) return;
    if (gate.status === 'ok') {
      markForceUpdateSuccess();
      resetForceUpdateAttempts();
      setAutoUpdateBlocked(false);
      try { localStorage.removeItem(AUTO_RELOAD_GUARD_KEY); } catch { /* noop */ }
      return;
    }
    setAutoUpdateBlocked(hasExceededForceUpdateAttempts());
  }, [gate.loading, gate.status]);

  // ── AUTO PURGE em modo FORCE ────────────────────────────────────────────
  // Regra padrão: a cada release que sobe `app_min_version`, todas as
  // instâncias dos navegadores devem limpar SW/caches e recarregar uma única
  // vez, sem esperar interação do usuário. Guard via localStorage evita loop.
  useEffect(() => {
    if (gate.loading) return;
    if (gate.status !== 'force') return;
    if (autoUpdateBlocked) return;
    let alreadyDone = '';
    try { alreadyDone = localStorage.getItem(AUTO_RELOAD_GUARD_KEY) || ''; } catch { /* noop */ }
    if (alreadyDone === gate.minVersion) return;
    try { localStorage.setItem(AUTO_RELOAD_GUARD_KEY, gate.minVersion); } catch { /* noop */ }
    // Pequeno atraso para o React render completar e o usuário enxergar o modal.
    const t = setTimeout(() => { void forceClientUpdate(); }, 1200);
    return () => clearTimeout(t);
  }, [gate.loading, gate.status, gate.minVersion, autoUpdateBlocked]);

  if (gate.loading) return null;

  // ─────── FORCE: modal bloqueante ───────
  if (gate.status === 'force') {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-update-force-title"
        className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-background/95 backdrop-blur-xs p-6"
      >
        <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-8 shadow-2xl text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 id="app-update-force-title" className="text-xl font-bold text-foreground">
              Atualização necessária
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {gate.forceMessage || 'Para continuar usando o Preciso de Um, instale a versão mais recente.'}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
            Sua versão: <span className="font-mono font-semibold">{gate.currentVersion}</span>
            {' · '}Mínima exigida: <span className="font-mono font-semibold">{gate.minVersion}</span>
            {autoUpdateBlocked ? (
              <div className="text-destructive font-medium">
                A atualização automática foi interrompida para evitar loop. Assim que a nova versão publicada estiver disponível, este aviso some sozinho.
              </div>
            ) : null}
          </div>
          <Button
            size="lg"
            className="w-full"
            onClick={() => void purgeAndReload()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar agora
          </Button>
          {autoUpdateBlocked ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Última tentativa: {(() => {
                const lastAttemptAt = getForceUpdateStats().lastAttemptAt;
                return lastAttemptAt ? new Date(lastAttemptAt).toLocaleTimeString('pt-BR') : 'agora';
              })()}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  // ─────── SUGGEST: banner topo ───────
  if (gate.status === 'suggest' && dismissedFor !== gate.latestVersion) {
    return (
      <div
        role="region"
        aria-label="Atualização disponível"
        className="fixed top-0 inset-x-0 z-[60] bg-accent text-accent-foreground shadow-md"
      >
        <div className="mx-auto max-w-6xl px-4 py-2.5 flex items-center gap-3 text-sm">
          <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="flex-1 leading-snug">
            {gate.suggestMessage || 'Uma nova versão do app está disponível.'}
          </p>
          <button
            type="button"
            onClick={() => void purgeAndReload()}
            className="shrink-0 rounded-md bg-background/20 hover:bg-background/30 px-3 py-1 text-xs font-semibold transition-colors"
          >
            Atualizar
          </button>
          <button
            type="button"
            aria-label="Dispensar"
            onClick={() => {
              try { localStorage.setItem(DISMISS_KEY, gate.latestVersion); } catch { /* noop */ }
              setDismissedFor(gate.latestVersion);
            }}
            className="shrink-0 rounded-full p-1 hover:bg-background/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default AppVersionGate;

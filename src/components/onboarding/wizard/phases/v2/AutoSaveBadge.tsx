/**
 * AutoSaveBadge — selo de auto-save com feedback rico de progresso.
 *
 * Estados (prioridade do mais "ativo" para o mais "passivo"):
 *   1. remote-flushing  → "Salvando no servidor… Xs" (+ aviso de rede lenta >3s)
 *   2. local-saving     → "Salvando rascunho…"      (debounce/setSignal)
 *   3. saved            → "Salvo agora" → "Salvo há Xs"
 *   4. idle             → "Auto-save ativo"
 *
 * Por que unificar local + remoto neste componente:
 *  - O usuário não distingue "rascunho local" de "sync remoto"; só quer saber
 *    se pode fechar a aba sem perder o que digitou.
 *  - Mostramos o estado MAIS forte ativo (remoto > local). Se o remoto
 *    terminar e o local ainda estiver no debounce, voltamos para "saving"
 *    em vez de saltar para "saved" prematuramente.
 *  - Após sucesso, a etiqueta "Salvo há Xs" tranquiliza durante leituras
 *    longas (ex.: usuário lendo a etapa 19 antes de avançar).
 *
 * Dependências: lucide-react (Cloud/Check/Loader2/AlertCircle), tokens HSL.
 * Sem libs novas — atualização de UI pura.
 */
import { useEffect, useRef, useState } from 'react';
import { Cloud, Check, Loader2, AlertCircle } from 'lucide-react';

interface AutoSaveBadgeProps {
  /** Qualquer dependência cuja mudança signifique "novo dado para salvar". */
  signal: unknown;
  /** Duração do estado "salvando local" antes de virar "salvo". */
  savingMs?: number;
  /** Limite (ms) acima do qual o flush remoto é considerado lento. */
  slowNetworkThresholdMs?: number;
}

const SAVED_FRESH_WINDOW_MS = 4000; // "Salvo agora"
const SAVED_VISIBLE_WINDOW_MS = 30_000; // depois disso volta a "Auto-save ativo"

function formatElapsed(ms: number): string {
  if (ms < 1000) return '<1s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}min`;
}

export const AutoSaveBadge = ({
  signal,
  savingMs = 700,
  slowNetworkThresholdMs = 3000,
}: AutoSaveBadgeProps) => {
  const [localState, setLocalState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [remoteFlushing, setRemoteFlushing] = useState(false);
  const [remoteElapsed, setRemoteElapsed] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [savedElapsed, setSavedElapsed] = useState(0);

  const remoteStartRef = useRef<number | null>(null);
  const isFirstRender = useRef(true);

  // Sinal local: "salvando rascunho…" → "salvo".
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return; // não pisca "saving" no mount inicial
    }
    setLocalState('saving');
    const t1 = window.setTimeout(() => {
      setLocalState('saved');
      setSavedAt(Date.now());
    }, savingMs);
    const t2 = window.setTimeout(
      () => setLocalState((s) => (s === 'saved' ? 'idle' : s)),
      savingMs + SAVED_VISIBLE_WINDOW_MS,
    );
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [signal, savingMs]);

  // Eventos globais de flush remoto.
  useEffect(() => {
    const onStart = () => {
      remoteStartRef.current = Date.now();
      setRemoteElapsed(0);
      setRemoteFlushing(true);
    };
    const onEnd = () => {
      setRemoteFlushing(false);
      remoteStartRef.current = null;
      setRemoteElapsed(0);
      setSavedAt(Date.now());
      setLocalState('saved');
    };
    window.addEventListener('onboarding:remote-flush:start', onStart);
    window.addEventListener('onboarding:remote-flush:end', onEnd);
    return () => {
      window.removeEventListener('onboarding:remote-flush:start', onStart);
      window.removeEventListener('onboarding:remote-flush:end', onEnd);
    };
  }, []);

  // Tick de 1s para atualizar contadores enquanto há flush remoto OU "salvo há Xs".
  useEffect(() => {
    if (!remoteFlushing && savedAt === null) return;
    const id = window.setInterval(() => {
      if (remoteStartRef.current !== null) {
        setRemoteElapsed(Date.now() - remoteStartRef.current);
      }
      if (savedAt !== null) {
        setSavedElapsed(Date.now() - savedAt);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [remoteFlushing, savedAt]);

  // 1) Estado mais forte: flush remoto em andamento.
  if (remoteFlushing) {
    const slow = remoteElapsed >= slowNetworkThresholdMs;
    return (
      <span
        role="status"
        aria-live="polite"
        className={
          'inline-flex items-center gap-1 text-[10px] ' +
          (slow ? 'text-amber-600' : 'text-muted-foreground')
        }
      >
        {slow ? (
          <AlertCircle className="h-3 w-3" />
        ) : (
          <Loader2 className="h-3 w-3 animate-spin" />
        )}
        {slow ? 'Rede lenta — salvando' : 'Salvando no servidor'}
        {remoteElapsed >= 1000 ? ` · ${formatElapsed(remoteElapsed)}` : '…'}
      </span>
    );
  }

  // 2) Salvamento local em curso (debounce).
  if (localState === 'saving') {
    return (
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
      >
        <Loader2 className="h-3 w-3 animate-spin" /> Salvando rascunho…
      </span>
    );
  }

  // 3) Acabou de salvar → "Salvo agora" / "Salvo há Xs".
  if (localState === 'saved' && savedAt !== null) {
    const fresh = savedElapsed < SAVED_FRESH_WINDOW_MS;
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
        <Check className="h-3 w-3" />
        {fresh ? 'Salvo agora' : `Salvo há ${formatElapsed(savedElapsed)}`}
      </span>
    );
  }

  // 4) Repouso.
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
      <Cloud className="h-3 w-3" /> Auto-save ativo
    </span>
  );
};

export default AutoSaveBadge;

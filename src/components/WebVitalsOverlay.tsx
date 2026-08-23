/**
 * WebVitalsOverlay — exibe LCP, CLS e INP da sessão atual em qualquer página
 * pública, para validar no campo o impacto das otimizações de imagem.
 *
 * Ativação (nunca aparece para o visitante comum):
 *   - `?vitals=1` na URL — liga e memoriza na sessão;
 *   - `?vitals=0` — desliga.
 *
 * Somente leitura: consome o snapshot do `webVitalsMonitor` já instalado.
 */
import { useEffect, useState } from 'react';
import { useLocation } from '@/lib/router-compat';
import { Activity, X } from 'lucide-react';
import { getWebVitalsSnapshot } from '@/lib/webVitalsMonitor';
import { formatMetric, rateMetric, type Rating } from '@/lib/webVitals/summary';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'pdu_vitals_overlay';

const TONE: Record<Rating, string> = {
  good: 'text-emerald-500',
  'needs-improvement': 'text-amber-500',
  poor: 'text-destructive',
};

const Row = ({ metric, value }: { metric: 'LCP' | 'CLS' | 'INP'; value: number | null }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-muted-foreground">{metric}</span>
    <span className={cn('font-mono font-medium', value === null ? '' : TONE[rateMetric(metric, value)])}>
      {formatMetric(metric, value)}
    </span>
  </div>
);

const WebVitalsOverlay = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [snapshot, setSnapshot] = useState(() => getWebVitalsSnapshot());

  useEffect(() => {
    const param = new URLSearchParams(location.search).get('vitals');
    if (param === '1') sessionStorage.setItem(STORAGE_KEY, '1');
    if (param === '0') sessionStorage.removeItem(STORAGE_KEY);
    setVisible(sessionStorage.getItem(STORAGE_KEY) === '1');
  }, [location.search]);

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => setSnapshot({ ...getWebVitalsSnapshot() }), 1000);
    return () => window.clearInterval(id);
  }, [visible]);

  if (!visible) return null;

  return (
    <aside
      role="status"
      aria-label="Core Web Vitals desta página"
      className="motion-enter fixed bottom-20 left-3 z-[60] w-44 rounded-xl border border-border/70 bg-card/90 p-3 text-xs shadow-lg backdrop-blur-md"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-medium">
          <Activity className="h-3.5 w-3.5" aria-hidden />
          Web Vitals
        </span>
        <button
          type="button"
          aria-label="Fechar painel de Web Vitals"
          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setVisible(false);
          }}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <div className="space-y-1">
        <Row metric="LCP" value={snapshot.lcp} />
        <Row metric="CLS" value={snapshot.cls} />
        <Row metric="INP" value={snapshot.inp} />
      </div>
    </aside>
  );
};

export default WebVitalsOverlay;

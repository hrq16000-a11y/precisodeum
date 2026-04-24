import { AlertTriangle, MapPin, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  city: string | null;
  source: 'gps' | 'ip' | 'manual' | 'cache' | 'none';
  lastKnownAt: string | null;
  onRetry: () => void;
  onDismiss: () => void;
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return 'horário desconhecido';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return 'horário desconhecido';
  const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 60) return `há ${diffMin} min`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
}

const SOURCE_LABEL: Record<Props['source'], string> = {
  gps: 'GPS',
  ip: 'rede (IP)',
  manual: 'cidade escolhida',
  cache: 'última localização salva',
  none: 'localização padrão',
};

const GeoFallbackNotice = ({ city, source, lastKnownAt, onRetry, onDismiss }: Props) => {
  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3 sm:p-4"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          Não conseguimos obter sua localização agora
        </p>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Estamos usando sua <strong className="text-foreground">{SOURCE_LABEL[source]}</strong>
          {city ? <> em <strong className="inline-flex items-center gap-1 text-foreground"><MapPin className="h-3 w-3" />{city}</strong></> : null}
          {' '}({formatTimeAgo(lastKnownAt)}). Os resultados podem estar menos precisos.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Tentar novamente
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            <X className="mr-1 h-3.5 w-3.5" /> Continuar assim
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GeoFallbackNotice;

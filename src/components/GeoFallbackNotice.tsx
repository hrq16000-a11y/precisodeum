import { useEffect, useState } from 'react';
import { AlertTriangle, MapPin, RefreshCw, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CityAutocomplete from '@/components/CityAutocomplete';
import { useGeoCity } from '@/hooks/useGeoCity';
import { trackGeoEvent } from '@/lib/tracking';

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

/** Estimativa de raio de imprecisão por fonte (km) — para informar o usuário. */
const SOURCE_ACCURACY_KM: Record<Props['source'], { radius: number; label: string }> = {
  gps: { radius: 1, label: '~1 km (alta precisão)' },
  manual: { radius: 5, label: '~5 km (cidade escolhida)' },
  ip: { radius: 25, label: '~25 km (rede/IP)' },
  cache: { radius: 30, label: '~30 km (última posição salva)' },
  none: { radius: 100, label: '~100 km (padrão)' },
};

const GeoFallbackNotice = ({ city, source, lastKnownAt, onRetry, onDismiss }: Props) => {
  const { setCity } = useGeoCity();
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ city: '', state: '' });

  // Telemetria: registra exibição do fallback uma vez por montagem.
  useEffect(() => {
    trackGeoEvent('geo_fallback_used', { source, city: city || '', lastKnownAt: lastKnownAt || '' });
  }, [source, city, lastKnownAt]);

  const accuracy = SOURCE_ACCURACY_KM[source];

  const handleRetry = () => {
    trackGeoEvent('geo_failed', { source, action: 'retry' });
    onRetry();
  };

  const handleManualPick = (next: { city: string; state: string }) => {
    setManual(next);
    if (next.city) {
      setCity(next.city, next.state);
      trackGeoEvent('geo_failed', { source, action: 'manual_picked', picked_city: next.city, picked_state: next.state });
      setManualOpen(false);
      onDismiss();
    }
  };

  return (
    <div
      role="status"
      data-testid="geo-fallback-notice"
      className="mb-4 flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3 sm:p-4"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Não conseguimos obter sua localização agora
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Estamos usando sua <strong className="text-foreground">{SOURCE_LABEL[source]}</strong>
            {city ? <> em <strong className="inline-flex items-center gap-1 text-foreground"><MapPin className="h-3 w-3" />{city}</strong></> : null}
            {' '}({formatTimeAgo(lastKnownAt)}).
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Precisão estimada: <strong className="text-foreground">{accuracy.label}</strong>. Os resultados podem estar menos precisos.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Tentar novamente
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setManualOpen((v) => !v)}
              aria-expanded={manualOpen}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Escolher cidade/CEP manualmente
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
              <X className="mr-1 h-3.5 w-3.5" /> Continuar assim
            </Button>
          </div>
        </div>
      </div>

      {manualOpen && (
        <div className="ml-8 max-w-sm">
          <CityAutocomplete
            value={manual}
            onChange={handleManualPick}
            placeholder="Buscar minha cidade..."
          />
        </div>
      )}
    </div>
  );
};

export default GeoFallbackNotice;

/**
 * LocationSourceHistoryCard — histórico de origem da localização do prestador.
 * Lê via RPC `list_my_geo_audit` (owner-safe). Mostra fonte, cidade, precisão e latência.
 */
import { useEffect, useState } from 'react';
import { Loader2, MapPin, LocateFixed, Mailbox, Globe, UserCog } from 'lucide-react';
import { listMyGeoAudit, type GeoAuditEntry } from '@/lib/providerGeoAudit';

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  gps: LocateFixed,
  cep: Mailbox,
  ip: Globe,
  manual: UserCog,
  cache: MapPin,
  unknown: MapPin,
};

const SOURCE_LABELS: Record<string, string> = {
  gps: 'GPS preciso',
  cep: 'CEP',
  ip: 'IP aproximado',
  manual: 'Manual',
  cache: 'Cache',
  unknown: 'Desconhecido',
};

export default function LocationSourceHistoryCard() {
  const [entries, setEntries] = useState<GeoAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await listMyGeoAudit(30);
      if (!cancelled) {
        setEntries(rows);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico de localização…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Nenhum evento de localização registrado ainda. Use o GPS no cadastro para criar o primeiro.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <header className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-foreground">Histórico de origem da localização</h3>
        <p className="text-[11px] text-muted-foreground">
          GPS, CEP, IP e edições manuais. Use para auditoria e suporte.
        </p>
      </header>
      <ul className="divide-y divide-border">
        {entries.map((entry) => {
          const Icon = SOURCE_ICONS[entry.source] || MapPin;
          const date = new Date(entry.created_at);
          return (
            <li key={entry.id} className="flex items-start gap-3 px-4 py-2.5 text-xs">
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">
                    {SOURCE_LABELS[entry.source] || entry.source}
                  </span>
                  <time className="text-[10px] text-muted-foreground">
                    {date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </time>
                </div>
                <div className="text-muted-foreground">
                  {entry.city || '—'}{entry.state ? ` / ${entry.state}` : ''}
                  {entry.neighborhood ? ` · ${entry.neighborhood}` : ''}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                  {entry.accuracy_m != null && <span>±{Math.round(entry.accuracy_m)}m</span>}
                  {entry.latency_ms != null && <span>{Math.round(entry.latency_ms)}ms</span>}
                  <span className="opacity-70">{entry.event_type}</span>
                  {entry.error_message && <span className="text-rose-600">erro: {entry.error_message}</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

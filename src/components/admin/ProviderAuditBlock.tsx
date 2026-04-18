import { useEffect, useState } from 'react';
import { Clock, Globe, Smartphone, Monitor, Tablet, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AuditData {
  registration_ip: string | null;
  registration_isp: string | null;
  registration_city: string | null;
  registration_region: string | null;
  registration_country: string | null;
  registration_user_agent: string | null;
  registration_device: string | null;
  registration_os: string | null;
  registration_browser: string | null;
  first_access_at: string | null;
  last_ip: string | null;
  last_device: string | null;
  last_browser: string | null;
  last_access_at: string | null;
  provider_created_at: string | null;
}

interface Props {
  providerId: string;
  /** When provided, highlights when this IP is shared with other accounts */
  duplicateIps?: Set<string>;
}

const DeviceIcon = ({ device, className }: { device?: string | null; className?: string }) => {
  const d = (device || '').toLowerCase();
  if (d === 'mobile') return <Smartphone className={className} />;
  if (d === 'tablet') return <Tablet className={className} />;
  return <Monitor className={className} />;
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('pt-BR');
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${date} às ${time}`;
  } catch {
    return iso;
  }
};

const ProviderAuditBlock = ({ providerId, duplicateIps }: Props) => {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: row } = await supabase
        .from('provider_audit_view' as any)
        .select('*')
        .eq('provider_id', providerId)
        .maybeSingle();
      if (!cancelled) {
        setData(row as any);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [providerId]);

  if (loading) {
    return <p className="text-[10px] text-muted-foreground">Carregando auditoria…</p>;
  }
  if (!data) {
    return <p className="text-[10px] text-muted-foreground">Sem registros de auditoria.</p>;
  }

  const isDuplicateIp = !!(data.registration_ip && duplicateIps?.has(data.registration_ip));

  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        Auditoria de Cadastro
      </p>
      <div className="space-y-1 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 shrink-0" />
          <span><span className="font-medium text-foreground">Cadastro:</span> {formatDateTime(data.provider_created_at)}</span>
        </div>
        {data.first_access_at && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 shrink-0 opacity-60" />
            <span><span className="font-medium text-foreground">1º acesso:</span> {formatDateTime(data.first_access_at)}</span>
          </div>
        )}
        {data.registration_ip && (
          <div className={`flex items-center gap-1.5 ${isDuplicateIp ? 'text-amber-600 dark:text-amber-400' : ''}`}>
            <Globe className="h-3 w-3 shrink-0" />
            <span>
              <span className="font-medium text-foreground">IP:</span>{' '}
              <span className="font-mono">{data.registration_ip}</span>
              {isDuplicateIp && (
                <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 text-[9px] font-semibold">
                  <AlertTriangle className="h-2.5 w-2.5" /> compartilhado
                </span>
              )}
            </span>
          </div>
        )}
        {data.registration_isp && (
          <div className="pl-4 text-[10px]">
            <span className="font-medium text-foreground">ISP:</span> {data.registration_isp}
          </div>
        )}
        {(data.registration_city || data.registration_region || data.registration_country) && (
          <div className="pl-4 text-[10px]">
            <span className="font-medium text-foreground">Local:</span>{' '}
            {[data.registration_city, data.registration_region, data.registration_country].filter(Boolean).join(', ')}
          </div>
        )}
        {(data.registration_browser || data.registration_os) && (
          <div className="flex items-center gap-1.5">
            <DeviceIcon device={data.registration_device} className="h-3 w-3 shrink-0" />
            <span>
              <span className="font-medium text-foreground">Dispositivo:</span>{' '}
              {[data.registration_browser, data.registration_os].filter(Boolean).join(' / ')}
            </span>
          </div>
        )}
        {data.last_access_at && data.last_access_at !== data.first_access_at && (
          <div className="mt-1 pt-1 border-t border-border/40">
            <span className="font-medium text-foreground">Último acesso:</span> {formatDateTime(data.last_access_at)}
            {data.last_ip && data.last_ip !== data.registration_ip && (
              <span className="ml-1 text-[9px]">(IP atual: <span className="font-mono">{data.last_ip}</span>)</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderAuditBlock;

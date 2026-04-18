import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Ban, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface IpBlock {
  id: string;
  ip_address: string;
  reason: string;
  signup_count: number;
  blocked_until: string;
  created_at: string;
  active: boolean;
}

/**
 * Painel de Alertas Críticos para /admin/overview.
 * Mostra total de perfis suspeitos + feed dos últimos bloqueios de IP.
 */
const AdminCriticalAlerts = () => {
  const [suspiciousCount, setSuspiciousCount] = useState(0);
  const [blocks, setBlocks] = useState<IpBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: summary }, { data: blockData }] = await Promise.all([
      supabase.rpc('admin_suspicious_summary' as any, { _limit: 1 }),
      supabase.rpc('admin_recent_ip_blocks' as any, { _limit: 8 }),
    ]);
    setSuspiciousCount(((summary as any)?.total ?? 0) as number);
    setBlocks(((blockData as any) || []) as IpBlock[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const hasAlerts = suspiciousCount > 0 || blocks.length > 0;
  if (loading || !hasAlerts) return null;

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="h-5 w-5 text-destructive" />
        <h2 className="font-display text-base font-bold text-foreground">Alertas Críticos</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Suspeitos */}
        {suspiciousCount > 0 && (
          <Link
            to="/admin/usuarios?suspicious=1"
            className="group rounded-xl border border-destructive/40 bg-card p-4 hover:border-destructive transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Perfis sob suspeita</p>
                <p className="mt-1 text-3xl font-bold text-destructive">{suspiciousCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">Múltiplos cadastros do mesmo IP</p>
              </div>
              <Ban className="h-8 w-8 text-destructive/70 group-hover:scale-110 transition-transform" />
            </div>
            <p className="mt-3 text-xs font-medium text-destructive group-hover:underline">
              Ver lista filtrada →
            </p>
          </Link>
        )}

        {/* Feed de bloqueios */}
        {blocks.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Últimos bloqueios de IP
              </p>
            </div>
            <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {blocks.map(b => (
                <li key={b.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${b.active ? 'bg-destructive animate-pulse' : 'bg-muted-foreground'}`} />
                    <span className="font-mono text-foreground truncate">{b.ip_address}</span>
                    <span className="text-muted-foreground shrink-0">· {b.signup_count} cadastros</span>
                  </div>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    {formatDistanceToNow(new Date(b.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCriticalAlerts;

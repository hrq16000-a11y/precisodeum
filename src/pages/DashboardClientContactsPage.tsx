import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWhatsappQuota } from '@/hooks/useWhatsappQuota';
import {
  MessageCircle,
  ExternalLink,
  ListChecks,
  ShieldCheck,
  AlertCircle,
  MapPin,
  Clock,
  Sparkles,
  Repeat2,
} from 'lucide-react';

type ContactRow = {
  id: string;
  provider_id: string;
  clicked_at: string;
  clicked_on_utc: string;
  provider: {
    id: string;
    business_name: string | null;
    slug: string | null;
    whatsapp: string | null;
    phone: string | null;
    photo_url: string | null;
    city: string | null;
    state: string | null;
  } | null;
};

function buildWaUrl(p: ContactRow['provider']): string | null {
  if (!p) return null;
  const raw = (p.whatsapp ?? p.phone ?? '').replace(/\D/g, '');
  if (!raw) return null;
  const digits = raw.startsWith('55') ? raw : `55${raw}`;
  return `https://wa.me/${digits}`;
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
}

const DashboardClientContactsPage = () => {
  const { user } = useAuth();
  const quotaQ = useWhatsappQuota(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ['whatsapp-contacts-history', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_clicks_log')
        .select(`
          id, provider_id, clicked_at, clicked_on_utc,
          provider:providers!whatsapp_clicks_log_provider_id_fkey (
            id, business_name, slug, whatsapp, phone, photo_url, city, state
          )
        `)
        .order('clicked_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ContactRow[];
    },
  });

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  // Build per-provider total day-count to mark "novo desbloqueio" vs "recorrente"
  const providerDayCount = useMemo(() => {
    const map = new Map<string, number>();
    (data ?? []).forEach((r) => map.set(r.provider_id, (map.get(r.provider_id) ?? 0) + 1));
    return map;
  }, [data]);
  const today = (data ?? []).filter((r) => r.clicked_on_utc === todayKey);
  const older = (data ?? []).filter((r) => r.clicked_on_utc !== todayKey);

  const quota = quotaQ.data;
  const limit = quota?.daily_limit ?? 3;
  const remaining = quota?.remaining_today ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ListChecks className="h-6 w-6 text-primary" aria-hidden="true" />
              Meus Contatos
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Historico dos prestadores que voce desbloqueou. Voce pode acessar ate {limit} contatos
              novos por dia. Reabrir um prestador ja desbloqueado hoje nao consome cota.
            </p>
          </div>
          <Card className="min-w-[14rem]">
            <CardContent className="p-3 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              <div className="text-sm">
                <div className="font-semibold">Cota de hoje</div>
                <div className="text-muted-foreground">
                  {quotaQ.isLoading ? '...' : `${remaining} de ${limit} disponivel(eis)`}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
            <AlertCircle className="h-4 w-4 mt-0.5" aria-hidden="true" />
            <span>Nao foi possivel carregar seus contatos. Tente novamente em instantes.</span>
          </div>
        )}

        <Section
          title="Hoje"
          icon={<Clock className="h-5 w-5 text-primary" aria-hidden="true" />}
          rows={today}
          loading={isLoading}
          emptyText="Voce ainda nao desbloqueou contatos hoje."
          providerDayCount={providerDayCount}
        />

        <Section
          title="Historico anterior"
          icon={<ListChecks className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
          rows={older}
          loading={isLoading}
          emptyText="Sem contatos anteriores no historico."
          showDate
          providerDayCount={providerDayCount}
        />
      </div>
    </DashboardLayout>
  );
};

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  rows: ContactRow[];
  loading: boolean;
  emptyText: string;
  showDate?: boolean;
  providerDayCount?: Map<string, number>;
}

function Section({ title, icon, rows, loading, emptyText, showDate, providerDayCount }: SectionProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
          {!loading && rows.length > 0 && (
            <Badge variant="secondary" className="ml-1">{rows.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => {
              const p = row.provider;
              const waUrl = buildWaUrl(p);
              const profileUrl = p?.slug ? `/profissional/${p.slug}` : null;
              const totalDays = providerDayCount?.get(row.provider_id) ?? 1;
              const isRecurring = totalDays > 1;
              return (
                <li key={row.id} className="py-3 flex items-center gap-3">
                  {p?.photo_url ? (
                    <img
                      src={p.photo_url}
                      alt=""
                      loading="lazy"
                      className="h-10 w-10 rounded-full object-cover bg-muted shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted shrink-0 grid place-items-center">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {profileUrl ? (
                        <Link to={profileUrl} className="hover:underline">
                          {p?.business_name ?? 'Prestador'}
                        </Link>
                      ) : (
                        p?.business_name ?? 'Prestador'
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {isRecurring ? (
                        <Badge variant="outline" className="gap-1 text-[10px] py-0 h-5">
                          <Repeat2 className="h-3 w-3" aria-hidden="true" />
                          Recorrente ({totalDays}x)
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-[10px] py-0 h-5">
                          <Sparkles className="h-3 w-3" aria-hidden="true" />
                          Novo desbloqueio
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      {(p?.city || p?.state) && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          {[p?.city, p?.state].filter(Boolean).join(' / ')}
                        </span>
                      )}
                      {showDate && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {formatDate(row.clicked_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {profileUrl && (
                      <Button asChild size="sm" variant="outline">
                        <Link to={profileUrl}>
                          <ExternalLink className="h-4 w-4 mr-1" aria-hidden="true" />
                          Ver perfil
                        </Link>
                      </Button>
                    )}
                    {waUrl && (
                      <Button asChild size="sm">
                        <a href={waUrl} data-wa-target-type="provider" data-wa-target-id={p?.id}>
                          <MessageCircle className="h-4 w-4 mr-1" aria-hidden="true" />
                          WhatsApp
                        </a>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default DashboardClientContactsPage;

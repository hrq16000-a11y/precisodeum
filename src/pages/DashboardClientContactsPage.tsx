import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuthIdentity } from '@/hooks/useAuth';
import { useWhatsappQuota } from '@/hooks/useWhatsappQuota';
import { useDebounce } from '@/hooks/useDebounce';
import {
  MessageCircle, ExternalLink, ListChecks, ShieldCheck, AlertCircle,
  MapPin, Clock, Sparkles, Repeat2, Search, X, ArrowUpDown,
} from 'lucide-react';

type ContactRow = {
  id: string;
  provider_id: string;
  clicked_at: string;
  clicked_on_utc: string;
  is_today: boolean;
  provider_total: number;
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

type SortKey = 'recent' | 'recurring' | 'provider';
const PAGE_SIZE = 20;
const SORT_LABEL: Record<SortKey, string> = {
  recent: 'Mais recentes',
  recurring: 'Mais recorrentes',
  provider: 'Por prestador (A-Z)',
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
  const { user } = useAuthIdentity();
  const quotaQ = useWhatsappQuota(true);
  const [params, setParams] = useSearchParams();

  const search = params.get('q') ?? '';
  const sort = (params.get('sort') as SortKey) || 'recent';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [searchInput, setSearchInput] = useState(search);
  const debounced = useDebounce(searchInput, 300);

  // Sync debounced search to URL (reset page)
  useEffect(() => {
    if (debounced === search) return;
    const next = new URLSearchParams(params);
    if (debounced) next.set('q', debounced); else next.delete('q');
    next.delete('page');
    setParams(next, { replace: true });
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value && value !== '') next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const offset = (page - 1) * PAGE_SIZE;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['whatsapp-contacts-history', user?.id, search, sort, page],
    enabled: !!user,
    placeholderData: keepPreviousData,
    // Cache de 30s + reuso de 2min: chamadas com mesma combinação (q,sort,page)
    // dentro dessa janela são servidas do cache do React Query, sem ir ao banco.
    staleTime: 30_000,
    gcTime: 120_000,
    queryFn: async () => {
      const t0 = performance.now();
      const { data, error } = await supabase.rpc('list_whatsapp_contacts_history', {
        _search: search || null,
        _sort: sort,
        _limit: PAGE_SIZE,
        _offset: offset,
      });
      const elapsed = Math.round(performance.now() - t0);
      if (error) throw error;
      const payload = data as { total: number; rows: ContactRow[]; _perf_ms?: number };
      // Telemetria client-side: avisa no console quando ficar lento (>1s round-trip).
      if (elapsed > 1000) {
        // eslint-disable-next-line no-console
        console.warn('[contacts-history] slow RPC', {
          elapsed_ms: elapsed,
          server_ms: payload?._perf_ms,
          sort, page, q_len: search.length, total: payload?.total,
        });
      }
      return payload;
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const todayRows = useMemo(() => rows.filter((r) => r.is_today), [rows]);
  const olderRows = useMemo(() => rows.filter((r) => !r.is_today), [rows]);

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
                  {quotaQ.isLoading ? (
                    <Skeleton className="h-4 w-28 inline-block align-middle" />
                  ) : (
                    `${remaining} de ${limit} disponivel(eis)`
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[16rem] max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <Input
              type="search"
              placeholder="Buscar prestador por nome ou cidade"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 pr-9"
              aria-label="Buscar prestador no historico"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Select value={sort} onValueChange={(v) => updateParam('sort', v === 'recent' ? null : v)}>
              <SelectTrigger className="w-[200px]" aria-label="Ordenar historico">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">{SORT_LABEL.recent}</SelectItem>
                <SelectItem value="recurring">{SORT_LABEL.recurring}</SelectItem>
                <SelectItem value="provider">{SORT_LABEL.provider}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <div
            className="flex flex-wrap items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            role="alert"
            data-testid="contacts-error"
          >
            <AlertCircle className="h-4 w-4 mt-0.5" aria-hidden="true" />
            <span className="flex-1 min-w-[12rem]">
              Nao foi possivel carregar seus contatos. Tente novamente em instantes.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="contacts-retry"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {!isLoading && !error && total === 0 && !search ? (
          <Card data-testid="contacts-empty">
            <CardContent className="p-8 text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted grid place-items-center">
                <MessageCircle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Voce ainda nao desbloqueou nenhum contato</p>
                <p className="text-sm text-muted-foreground">
                  Quando voce abrir o WhatsApp de um prestador, ele aparecera aqui automaticamente.
                </p>
              </div>
              <Button asChild size="sm">
                <Link to="/buscar">Encontrar prestadores</Link>
              </Button>
            </CardContent>
          </Card>
        ) : sort === 'recent' ? (
          <>
            <Section
              title="Hoje"
              icon={<Clock className="h-5 w-5 text-primary" aria-hidden="true" />}
              rows={todayRows}
              loading={isLoading}
              emptyText={search ? 'Nenhum prestador encontrado para a busca.' : 'Voce ainda nao desbloqueou contatos hoje.'}
            />
            <Section
              title="Historico anterior"
              icon={<ListChecks className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
              rows={olderRows}
              loading={isLoading}
              emptyText={search ? 'Nenhum prestador encontrado para a busca.' : 'Sem contatos anteriores nesta pagina.'}
              showDate
            />
          </>
        ) : (
          <Section
            title={SORT_LABEL[sort]}
            icon={<ListChecks className="h-5 w-5 text-primary" aria-hidden="true" />}
            rows={rows}
            loading={isLoading}
            emptyText={search ? 'Nenhum prestador encontrado para a busca.' : 'Sem contatos no historico.'}
            showDate
          />
        )}

        {/* Paginação */}
        {!isLoading && total > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
            <span className="text-muted-foreground">
              Mostrando {Math.min(offset + 1, total)}-{Math.min(offset + rows.length, total)} de {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => updateParam('page', page - 1 <= 1 ? null : String(page - 1))}
              >
                Anterior
              </Button>
              <span className="px-2">Pagina {page} de {totalPages}</span>
              <Button
                variant="outline" size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => updateParam('page', String(page + 1))}
              >
                Proxima
              </Button>
            </div>
          </div>
        )}
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
}

function ContactRowSkeleton() {
  return (
    <li className="py-3 flex items-center gap-3" aria-hidden="true">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-8 w-24 shrink-0" />
    </li>
  );
}

function Section({ title, icon, rows, loading, emptyText, showDate }: SectionProps) {
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
          <>
            <span className="sr-only" role="status" aria-live="polite">
              Carregando seus contatos...
            </span>
            <ul className="divide-y" aria-busy="true" data-testid="contacts-loading">
              <ContactRowSkeleton />
              <ContactRowSkeleton />
              <ContactRowSkeleton />
            </ul>
          </>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">{emptyText}</p>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => {
              const p = row.provider;
              const waUrl = buildWaUrl(p);
              const profileUrl = p?.slug ? `/profissional/${p.slug}` : null;
              const totalDays = row.provider_total ?? 1;
              const isRecurring = totalDays > 1;
              return (
                <li key={row.id} className="py-3 flex items-center gap-3">
                  {p?.photo_url ? (
                    <img
                      src={p.photo_url}
                      alt={`Foto de ${p?.business_name || 'profissional'}`}
                      loading="lazy"
                      decoding="async"
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

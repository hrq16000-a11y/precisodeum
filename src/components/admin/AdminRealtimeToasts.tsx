import { useEffect, useRef } from 'react';
import { acquireChannel, releaseChannel } from '@/lib/realtimeRegistry';
import { toast } from 'sonner';

/**
 * Listens for realtime DB events and shows sonner toasts for admin.
 *
 * Controles anti-flood (não filtra o channel — admin precisa ver tudo):
 *  - **Debounce 2s por tabela**: rajadas viram um único toast consolidado
 *    ("X novos eventos em <tabela>") em vez de N toasts.
 *  - **Rate limit local**: >10 eventos em <30s pausa toasts por 60s e
 *    mostra um único aviso fixo no topo.
 */
const DEBOUNCE_MS = 2000;
const RATE_WINDOW_MS = 30_000;
const RATE_THRESHOLD = 10;
const MUTE_MS = 60_000;
const MUTE_TOAST_ID = 'admin-realtime-muted';

type TableKey = 'providers' | 'leads' | 'reviews' | 'profiles' | 'error_reports';

const TABLE_LABEL: Record<TableKey, string> = {
  providers: 'novos prestadores',
  leads: 'novos leads',
  reviews: 'novas avaliações',
  profiles: 'novos usuários',
  error_reports: 'erros reportados',
};

const TOAST_KIND: Record<TableKey, 'info' | 'success' | 'warning' | 'error'> = {
  providers: 'info',
  leads: 'info',
  reviews: 'success',
  profiles: 'info',
  error_reports: 'error',
};

interface PendingBucket {
  count: number;
  firstPayload: any;
  timer: ReturnType<typeof setTimeout> | null;
}

const AdminRealtimeToasts = () => {
  const bucketsRef = useRef<Map<TableKey, PendingBucket>>(new Map());
  const eventTimestampsRef = useRef<number[]>([]);
  const mutedUntilRef = useRef<number>(0);

  useEffect(() => {
    const buckets = bucketsRef.current;

    const isMuted = () => Date.now() < mutedUntilRef.current;

    const trackRate = () => {
      const now = Date.now();
      const arr = eventTimestampsRef.current;
      arr.push(now);
      // Mantém apenas eventos dentro da janela
      while (arr.length > 0 && now - arr[0] > RATE_WINDOW_MS) arr.shift();
      if (arr.length > RATE_THRESHOLD && !isMuted()) {
        mutedUntilRef.current = now + MUTE_MS;
        toast.warning('Alto volume de atividade — notificações pausadas por 60s', {
          id: MUTE_TOAST_ID,
          duration: MUTE_MS,
        });
      }
    };

    const flush = (table: TableKey) => {
      const bucket = buckets.get(table);
      if (!bucket || bucket.count === 0) return;
      const { count, firstPayload } = bucket;
      buckets.set(table, { count: 0, firstPayload: null, timer: null });

      if (isMuted()) return;

      const kind = TOAST_KIND[table];
      const fn = toast[kind] as (msg: string, opts?: any) => void;

      if (count === 1) {
        // Toast individual original (preserva descrição rica do payload)
        renderSingle(table, firstPayload);
      } else {
        fn(`${count} ${TABLE_LABEL[table]}`, {
          description: 'Eventos consolidados nos últimos 2s',
          duration: 5000,
        });
      }
    };

    const enqueue = (table: TableKey, payload: any) => {
      trackRate();
      const existing = buckets.get(table);
      if (existing && existing.timer) {
        existing.count += 1;
        return;
      }
      const bucket: PendingBucket = {
        count: 1,
        firstPayload: payload,
        timer: setTimeout(() => flush(table), DEBOUNCE_MS),
      };
      buckets.set(table, bucket);
    };

    const renderSingle = (table: TableKey, payload: any) => {
      const row = payload?.new ?? {};
      switch (table) {
        case 'providers': {
          if (row.status === 'pending') {
            toast.warning('Novo prestador pendente', {
              description: row.business_name || 'Aguardando aprovação',
              duration: 6000,
            });
          } else {
            toast.success('Novo prestador cadastrado', {
              description: row.business_name || '',
              duration: 5000,
            });
          }
          return;
        }
        case 'leads':
          toast.info('Novo lead recebido', {
            description: row.client_name || 'Lead registrado',
            duration: 5000,
          });
          return;
        case 'reviews':
          toast.success('Nova avaliação recebida', { duration: 4000 });
          return;
        case 'profiles':
          toast.info('Novo usuário cadastrado', {
            description: row.full_name || row.email || '',
            duration: 4000,
          });
          return;
        case 'error_reports':
          toast.error('Erro reportado', {
            description: row.error_message?.slice(0, 80) || 'Verifique o painel',
            duration: 8000,
          });
          return;
      }
    };

    acquireChannel('admin-realtime-toasts', {
      // Filtros server-side: reduzem WebSocket flood + carga RLS no Postgres.
      // - providers: somente novos pendentes (que exigem ação do admin).
      // - error_reports: somente severidade crítica (ruído operacional fica fora).
      // - leads/reviews/profiles: sem filtro — admin precisa ver todos.
      setup: (ch) => ch
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'providers', filter: 'status=eq.pending' }, (p) => enqueue('providers', p))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (p) => enqueue('leads', p))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, (p) => enqueue('reviews', p))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (p) => enqueue('profiles', p))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'error_reports', filter: 'severity=eq.critical' }, (p) => enqueue('error_reports', p)),
    });

    return () => {
      buckets.forEach((b) => { if (b.timer) clearTimeout(b.timer); });
      buckets.clear();
      releaseChannel('admin-realtime-toasts');
    };
  }, []);

  return null;
};

export default AdminRealtimeToasts;

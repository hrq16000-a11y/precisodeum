import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, Send, Trash2, Lock, Unlock, CheckCircle2, RotateCcw, ExternalLink, Trophy, Sparkles, UserCircle2, Filter, ArrowDownUp, Megaphone } from 'lucide-react';

// Regra de negócio: prestadores são 100% gratuitos — priorização SOMENTE por nível Ouro+.
// Patrocinadores são pagantes por definição (rótulo "Patrocinador" basta, sem badge "Pago").
const GOLD_PLUS_LEVELS = new Set(['Ouro', 'Platina', 'Diamante', 'Mestre']);
const isGoldPlusLevel = (lvl?: string | null) => !!lvl && GOLD_PLUS_LEVELS.has(lvl);
type RequesterKind = 'sponsor' | 'provider' | 'client' | 'other';
const getRequesterKind = (ctx: any): RequesterKind => {
  const k = ctx?.profile_snapshot?.requester_kind;
  if (k === 'sponsor' || k === 'provider' || k === 'client') return k;
  return 'other';
};
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAGE_SIZE = 20;

type TicketRow = {
  id: string;
  user_id: string;
  subject: string;
  status: 'open_user' | 'open_admin' | 'closed';
  consecutive_user_msgs: number;
  user_city: string | null;
  user_full_name: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_admin: number;
  blocked: boolean;
  updated_at: string;
  context: Record<string, any> | null;
};

export default function AdminSupportTicketsPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open_user' | 'open_admin' | 'closed' | 'blocked'>('all');
  // Tipo do solicitante: substitui o antigo "planFilter" (que misturava prestador c/ pagamento).
  const [kindFilter, setKindFilter] = useState<'all' | 'sponsor' | 'provider_gold' | 'provider_other'>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  // Ordenação orgânica: patrocinadores → prestadores Ouro+ → demais.
  const [sortBy, setSortBy] = useState<'recent' | 'organic_priority'>('recent');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [search, statusFilter, kindFilter, levelFilter, sortBy]);

  const { data: ticketsPage, isLoading } = useQuery({
    queryKey: ['admin-support-tickets', search, statusFilter, kindFilter, levelFilter, sortBy, page],
    queryFn: async () => {
      let q: any = (supabase.from('support_tickets' as any).select('*', { count: 'exact' }) as any);
      if (statusFilter === 'blocked') q = q.eq('blocked', true);
      else if (statusFilter !== 'all') q = q.eq('status', statusFilter);

      // Filtros sobre o snapshot do perfil dentro de context (JSONB).
      // NUNCA filtramos prestadores por "plano" — eles são gratuitos.
      if (kindFilter === 'sponsor') {
        q = q.eq('context->profile_snapshot->>requester_kind', 'sponsor');
      } else if (kindFilter === 'provider_gold') {
        q = q
          .eq('context->profile_snapshot->>requester_kind', 'provider')
          .in('context->profile_snapshot->>account_level', ['Ouro', 'Platina', 'Diamante', 'Mestre']);
      } else if (kindFilter === 'provider_other') {
        q = q.eq('context->profile_snapshot->>requester_kind', 'provider');
        // exclusão Ouro+ feita client-side abaixo (Postgrest não tem NOT IN sobre JSONB)
      }
      if (levelFilter !== 'all') {
        q = q.eq('context->profile_snapshot->>account_level', levelFilter);
      }

      const term = search.trim();
      if (term) {
        const safe = term.replace(/[%,]/g, ' ');
        q = q.or(
          `user_full_name.ilike.%${safe}%,user_city.ilike.%${safe}%,subject.ilike.%${safe}%,last_message_text.ilike.%${safe}%`
        );
      }
      // Ordenação orgânica: patrocinador (sponsor) > prestador Ouro+ > demais.
      // requester_kind ordenado desc → 'sponsor' > 'provider' > 'client' > null (alfabético reverso).
      // O tier dentro de prestadores (Ouro+) é resolvido client-side abaixo.
      if (sortBy === 'organic_priority') {
        q = q.order('context->profile_snapshot->>requester_kind', { ascending: false, nullsFirst: false });
      }
      q = q.order('updated_at', { ascending: false })
           .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      let rows = (data || []) as TicketRow[];
      // Pós-filtro: "demais prestadores" = provider que NÃO é Ouro+.
      if (kindFilter === 'provider_other') {
        rows = rows.filter(r => !isGoldPlusLevel(r.context?.profile_snapshot?.account_level));
      }
      // Reordenação client-side para subir Ouro+ acima de demais prestadores
      // dentro do bloco "provider" (Postgrest não consegue fazer isso via JSONB).
      if (sortBy === 'organic_priority') {
        const rank = (r: TicketRow) => {
          const k = getRequesterKind(r.context);
          if (k === 'sponsor') return 0;
          if (k === 'provider' && isGoldPlusLevel(r.context?.profile_snapshot?.account_level)) return 1;
          if (k === 'provider') return 2;
          return 3;
        };
        rows = [...rows].sort((a, b) => rank(a) - rank(b));
      }
      return { rows, total: count || 0 };
    },
  });

  const tickets = ticketsPage?.rows || [];
  const total = ticketsPage?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const selected = useMemo(() => tickets.find(t => t.id === selectedId), [tickets, selectedId]);

  const { data: messages = [] } = useQuery({
    queryKey: ['admin-support-messages', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await (supabase
        .from('support_ticket_messages' as any)
        .select('*')
        .eq('ticket_id', selectedId!)
        .order('created_at', { ascending: true })
        .limit(500) as any);
      return (data || []) as any[];
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const sendReply = useMutation({
    mutationFn: async () => {
      if (!selectedId || !reply.trim()) return;
      const { error } = await (supabase
        .from('support_ticket_messages' as any)
        .insert({
          ticket_id: selectedId,
          sender_id: user!.id,
          sender_role: 'admin',
          content: reply.trim().slice(0, 4000),
        } as any) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setReply('');
      qc.invalidateQueries({ queryKey: ['admin-support-messages', selectedId] });
      qc.invalidateQueries({ queryKey: ['admin-support-tickets'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const setStatus = useMutation({
    mutationFn: async (status: 'open_user' | 'closed') => {
      if (!selectedId) return;
      const { error } = await (supabase.from('support_tickets' as any)
        .update({ status, ...(status === 'open_user' ? { consecutive_user_msgs: 0 } : {}) } as any)
        .eq('id', selectedId) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Ticket atualizado');
      qc.invalidateQueries({ queryKey: ['admin-support-tickets'] });
    },
  });

  const toggleBlock = useMutation({
    mutationFn: async (blocked: boolean) => {
      if (!selectedId) return;
      const { error } = await (supabase.from('support_tickets' as any)
        .update({ blocked: !blocked } as any).eq('id', selectedId) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-support-tickets'] }),
  });

  const deleteMessage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('support_ticket_messages' as any).delete().eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Mensagem removida');
      qc.invalidateQueries({ queryKey: ['admin-support-messages', selectedId] });
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
      {/* List + filters */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 space-y-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            Tickets ({total})
          </CardTitle>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, cidade, assunto…"
                className="h-9 pl-7 text-sm"
                aria-label="Buscar tickets"
              />
            </div>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
              <SelectTrigger className="h-9 w-[130px] text-xs" aria-label="Filtrar por status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open_user">Aguardando admin</SelectItem>
                <SelectItem value="open_admin">Limite (3)</SelectItem>
                <SelectItem value="closed">Fechados</SelectItem>
                <SelectItem value="blocked">Bloqueados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Filtros do snapshot do perfil + ordenação orgânica */}
          <div className="flex flex-wrap gap-2">
            <Select value={kindFilter} onValueChange={v => setKindFilter(v as any)}>
              <SelectTrigger className="h-8 w-[170px] text-[11px] gap-1" aria-label="Filtrar por tipo de solicitante">
                <UserCircle2 className="h-3 w-3" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="sponsor">Patrocinadores</SelectItem>
                <SelectItem value="provider_gold">Prestadores Ouro+</SelectItem>
                <SelectItem value="provider_other">Demais prestadores</SelectItem>
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="h-8 w-[130px] text-[11px] gap-1" aria-label="Filtrar por nível">
                <Trophy className="h-3 w-3" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                {['Iniciante','Entusiasta','Engajado','Ouro','Platina','Diamante','Mestre'].map(n => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
              <SelectTrigger className="h-8 w-[180px] text-[11px] gap-1" aria-label="Ordenação">
                <ArrowDownUp className="h-3 w-3" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais recentes</SelectItem>
                <SelectItem value="organic_priority">Prioridade orgânica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-2 max-h-[60vh] overflow-y-auto space-y-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" /></div>
          ) : tickets.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum ticket</p>
          ) : tickets.map(t => {
            const kind = getRequesterKind(t.context);
            const level = t.context?.profile_snapshot?.account_level as string | undefined;
            const isSponsor = kind === 'sponsor';
            const isProviderGold = kind === 'provider' && isGoldPlusLevel(level);
            const sponsorTier = t.context?.profile_snapshot?.sponsor?.sponsor_tier as string | undefined;
            const highlight = isSponsor
              ? 'border-l-4 border-l-primary bg-primary/5'
              : isProviderGold
                ? 'border-l-4 border-l-amber-500/70 bg-amber-500/5'
                : '';
            return (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              aria-label={`Ticket de ${t.user_full_name || 'usuário'}${isSponsor ? ' (patrocinador)' : isProviderGold ? ` (prestador ${level})` : ''}`}
              className={`w-full text-left rounded-lg p-2 transition-colors border ${
                selectedId === t.id ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted border-transparent'
              } ${highlight}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium truncate">{t.user_full_name || 'Usuário'}</span>
                <div className="flex gap-1 shrink-0">
                  {t.context?.source && (
                    <Badge variant="secondary" className="text-[9px]" title={`Origem: ${t.context.source}`}>
                      {t.context.source === 'services_limit_reached' ? 'Limite svc'
                        : t.context.source === 'services_faq_exception' ? 'FAQ svc'
                        : t.context.source === 'services_form_category_helper' ? 'Form svc'
                        : 'Ctx'}
                    </Badge>
                  )}
                  {t.blocked && <Badge variant="destructive" className="text-[9px]">Bloq</Badge>}
                  {t.status === 'open_admin' && <Badge variant="secondary" className="text-[9px]">3/3</Badge>}
                  {t.status === 'closed' && <Badge variant="outline" className="text-[9px]">Fechado</Badge>}
                  {t.unread_admin > 0 && <Badge className="text-[9px] h-4 min-w-4 px-1">{t.unread_admin}</Badge>}
                  {isSponsor && (
                    <Badge className="text-[9px] gap-0.5 bg-primary text-primary-foreground" aria-label={`Patrocinador${sponsorTier ? ` ${sponsorTier}` : ''}`}>
                      <Megaphone className="h-2.5 w-2.5" aria-hidden="true" />
                      {sponsorTier ? `Patrocinador ${sponsorTier}` : 'Patrocinador'}
                    </Badge>
                  )}
                  {isProviderGold && (
                    <Badge className="text-[9px] gap-0.5 bg-amber-500 text-white" aria-label={`Prestador ${level}`}>
                      <Trophy className="h-2.5 w-2.5" aria-hidden="true" />
                      {level}
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-foreground/80 truncate font-medium">{t.subject || '—'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{t.user_city || '—'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{t.last_message_text || '...'}</p>
              {t.last_message_at && (
                <p className="text-[9px] text-muted-foreground/60">
                  {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true, locale: ptBR })}
                </p>
              )}
            </button>
            );
          })}
        </CardContent>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border p-2 text-xs">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <span>Página {page + 1} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
          </div>
        )}
      </Card>

      {/* Detail */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            <span className="truncate">
              {selected ? `${selected.user_full_name || 'Usuário'} · ${selected.user_city || '—'}` : 'Selecione um ticket'}
            </span>
            {selected && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 gap-1"
                  onClick={() => toggleBlock.mutate(selected.blocked)}>
                  {selected.blocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  {selected.blocked ? 'Desbloquear' : 'Bloquear'}
                </Button>
                {selected.status === 'closed' ? (
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setStatus.mutate('open_user')}>
                    <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setStatus.mutate('closed')}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Fechar
                  </Button>
                )}
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex flex-col h-[60vh] min-h-[420px]">
          {selected?.context && Object.keys(selected.context).length > 0 && (
            <div className="border-b border-border bg-amber-500/5 px-3 py-2 text-[11px] leading-snug space-y-1">
              <p className="font-semibold text-amber-700 dark:text-amber-300">Contexto da solicitação</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                {selected.context.source && <span><b>Origem:</b> {String(selected.context.source)}</span>}
                {selected.context.services_count != null && <span><b>Serviços:</b> {selected.context.services_count}/{selected.context.cap ?? 5}</span>}
                {selected.context.attempted_categories != null && <span><b>Cat. tentadas:</b> {selected.context.attempted_categories}</span>}
              </div>
              {selected.context.profile_snapshot && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {selected.context.profile_snapshot.profile_slug && (
                    <a
                      href={`/profissional/${selected.context.profile_snapshot.profile_slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 hover:bg-muted"
                      title="Abrir perfil público"
                    >
                      <ExternalLink className="h-3 w-3" />
                      /{selected.context.profile_snapshot.profile_slug}
                    </a>
                  )}
                  {selected.context.profile_snapshot.profile_type && (
                    <Badge variant="outline" className="text-[9px] gap-1">
                      <UserCircle2 className="h-3 w-3" />
                      {selected.context.profile_snapshot.profile_type}
                    </Badge>
                  )}
                  {selected.context.profile_snapshot.current_plan && (
                    <Badge variant="secondary" className="text-[9px] gap-1">
                      <BadgeCheck className="h-3 w-3" />
                      {selected.context.profile_snapshot.current_plan}
                    </Badge>
                  )}
                  {selected.context.profile_snapshot.account_level && (
                    <Badge variant="secondary" className="text-[9px] gap-1">
                      <Trophy className="h-3 w-3" />
                      {selected.context.profile_snapshot.account_level}
                    </Badge>
                  )}
                  {selected.context.profile_snapshot.engagement_points != null && (
                    <Badge variant="outline" className="text-[9px] gap-1">
                      <Sparkles className="h-3 w-3" />
                      {selected.context.profile_snapshot.engagement_points} pts
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {!selectedId ? (
              <p className="text-sm text-muted-foreground text-center py-8">Selecione um ticket à esquerda</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem mensagens</p>
            ) : messages.map((msg: any) => {
              const isAdmin = msg.sender_role === 'admin';
              return (
                <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm relative ${
                    isAdmin ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  }`}>
                    <p className="text-[10px] opacity-70 mb-0.5">{isAdmin ? 'Admin' : 'Usuário'}</p>
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={`text-[9px] mt-1 ${isAdmin ? 'text-primary-foreground/60' : 'text-muted-foreground/60'}`}>
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                    <button
                      onClick={() => { if (confirm('Remover mensagem?')) deleteMessage.mutate(msg.id); }}
                      className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-1 opacity-0 group-hover:opacity-100 hover:opacity-100"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {selected && selected.status !== 'closed' && (
            <div className="border-t border-border p-3 flex items-end gap-2">
              <Textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="Responder ao usuário…"
                className="min-h-[60px] text-sm flex-1"
                maxLength={4000}
              />
              <Button size="sm" className="gap-1"
                onClick={() => sendReply.mutate()}
                disabled={!reply.trim() || sendReply.isPending}>
                {sendReply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

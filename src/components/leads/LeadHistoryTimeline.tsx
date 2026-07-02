/**
 * LeadHistoryTimeline — render compartilhado da timeline do lead com nome real do autor.
 *
 * Usa useLeadHistoryAuthors para resolver UUIDs → nomes via RPC segura.
 * Aceita modo "compact" (mini timeline no card da listagem) e completo (detalhe).
 */
import { Badge } from '@/components/ui/badge';
import { Paperclip } from 'lucide-react';
import { STATUS_META } from '@/hooks/useLeadFollowup';
import { useLeadHistoryAuthors } from '@/hooks/useLeadHistoryAuthors';

interface Item {
  id: string;
  entry_type: string;
  old_status: string | null;
  new_status: string | null;
  message: string | null;
  author_id?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  created_at: string;
}

interface Props {
  items: Item[];
  currentUserId?: string;
  compact?: boolean;
  emptyLabel?: string;
  maxItems?: number;
}

export default function LeadHistoryTimeline({
  items,
  currentUserId,
  compact = false,
  emptyLabel = 'Nenhuma movimentação registrada ainda.',
  maxItems,
}: Props) {
  const visible = maxItems ? items.slice(0, maxItems) : items;
  const authorIds = visible.map(i => i.author_id).filter((x): x is string => !!x);
  const { authors } = useLeadHistoryAuthors(authorIds);

  if (visible.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  function authorLabel(id?: string | null) {
    if (!id) return 'Sistema';
    if (id === currentUserId) return 'Você';
    return authors[id]?.full_name || 'Outro usuário';
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {visible.map((item) => {
        const isStatus = item.entry_type === 'status_change';
        const oldM = isStatus && item.old_status ? (STATUS_META as any)[item.old_status] : null;
        const newM = isStatus && item.new_status ? (STATUS_META as any)[item.new_status] : null;
        return (
          <div key={item.id} className="border-l-2 border-primary/30 pl-3">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                {isStatus ? 'Status' : 'Mensagem'}
              </Badge>
              <span className="font-medium text-foreground">{authorLabel(item.author_id)}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{new Date(item.created_at).toLocaleString('pt-BR')}</span>
            </div>
            {isStatus && oldM && newM && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {oldM.label} → <strong className="text-foreground">{newM.label}</strong>
              </p>
            )}
            {item.message && <p className="mt-0.5 text-xs text-foreground">{item.message}</p>}
            {item.attachment_url && (
              <a
                className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                href={item.attachment_url}
                target="_blank"
                rel="noreferrer"
              >
                <Paperclip className="h-3 w-3" />
                {item.attachment_name || 'Anexo'}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Inbox, Timer } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProviderLeads, isOverdue, STATUS_META } from '@/hooks/useLeadFollowup';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  className?: string;
}

/**
 * LeadFollowupWidget — alerta compacto no dashboard que destaca leads
 * em aberto e os que já passaram da janela de follow-up.
 */
const LeadFollowupWidget = ({ className = '' }: Props) => {
  const { provider } = useAuth();
  const { data: leads = [] } = useProviderLeads(provider?.id);

  const { overdue, openLeads } = useMemo(() => {
    const open = leads.filter((l) => l.status === 'new' || l.status === 'contacted');
    return { overdue: open.filter(isOverdue), openLeads: open };
  }, [leads]);

  if (openLeads.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border ${
        overdue.length > 0
          ? 'border-destructive/30 bg-gradient-to-br from-destructive/10 via-card to-card'
          : 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card'
      } p-4 ${className}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            overdue.length > 0 ? 'bg-destructive/15 text-destructive' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
          }`}
        >
          {overdue.length > 0 ? <AlertTriangle className="h-4 w-4" /> : <Timer className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">
            {overdue.length > 0
              ? `${overdue.length} lead${overdue.length > 1 ? 's' : ''} esperando follow-up`
              : `${openLeads.length} lead${openLeads.length > 1 ? 's' : ''} em aberto`}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Janela configurada: a cada {provider?.lead_followup_hours ?? 24}h
          </p>
        </div>
        <Link
          to="/dashboard/leads"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Abrir
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <ul className="space-y-1.5">
        {(overdue.length > 0 ? overdue : openLeads).slice(0, 3).map((lead) => {
          const meta = STATUS_META[lead.status];
          const over = isOverdue(lead);
          return (
            <li
              key={lead.id}
              className="flex items-center gap-2 rounded-lg bg-background/40 px-2.5 py-1.5"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
              <span className="flex-1 min-w-0 truncate text-xs font-medium text-foreground">
                {lead.client_name}
              </span>
              <span className={`text-[10px] shrink-0 ${over ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                {lead.next_followup_at
                  ? formatDistanceToNow(new Date(lead.next_followup_at), { addSuffix: true, locale: ptBR })
                  : meta.label}
              </span>
            </li>
          );
        })}
      </ul>

      {openLeads.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Inbox className="h-3.5 w-3.5" />
          Tudo em dia.
        </div>
      )}
    </motion.div>
  );
};

export default LeadFollowupWidget;

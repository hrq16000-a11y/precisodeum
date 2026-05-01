/**
 * VerificationStatusBadge — indicador unificado do estado de verificação
 * de identidade (CPF/CNPJ) do prestador.
 *
 * Estados derivados:
 *  - 'none'     → não enviou documento ainda
 *  - 'pending'  → enviou documento, provider.status = 'pending'
 *  - 'review'   → enviou documento, provider.status = 'pending' há > 0
 *                 (placeholder para futura fila manual; mesma cor do pending)
 *  - 'verified' → provider.status = 'active' E community_verified_at != null,
 *                 OU provider.status = 'active' como mínimo
 *
 * Realtime: assina mudanças em providers.status e community_verified_at
 * para o user logado, refletindo o estado em tempo real sem refresh.
 *
 * Uso: pode ser exibido no Dashboard, no header do perfil, no card do
 * onboarding, etc. Stateless de UI — só precisa do userId (ou do providerId).
 */

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export type VerificationState = 'loading' | 'none' | 'pending' | 'review' | 'verified';

interface ProviderRow {
  id: string;
  status: string | null;
  community_verified_at: string | null;
}

interface Props {
  userId: string | undefined;
  /** Se 'compact', mostra apenas badge mínima sem texto descritivo. */
  variant?: 'default' | 'compact';
  /** Se passado, exibe um pequeno timeline com a última atualização. */
  showHistory?: boolean;
  /**
   * Tipo do documento do usuário — usado para personalizar a copy ("CPF" para PF,
   * "CNPJ" para PJ). Se omitido, mantém a copy genérica "CPF/CNPJ".
   */
  docKind?: 'pf' | 'pj';
  /**
   * Quando true, o componente NÃO renderiza nada no estado 'none' (não enviado).
   * Útil em fluxos onde a ausência do documento já é evidente pela UI ao redor
   * (ex.: passo de upsell no wizard) — evita texto duplicado.
   */
  hideWhenNone?: boolean;
  className?: string;
}

/**
 * Resolve a label do documento conforme o tipo de pessoa.
 * Centralizado para evitar repetição "CPF/CNPJ" desnecessária quando já sabemos
 * que o usuário é PF ou PJ.
 */
function resolveDocLabel(kind?: 'pf' | 'pj'): string {
  if (kind === 'pj') return 'CNPJ';
  if (kind === 'pf') return 'CPF';
  return 'CPF/CNPJ';
}

const buildStateMeta = (docLabel: string): Record<VerificationState, {
  label: string;
  color: string;
  Icon: typeof ShieldCheck;
  description: string;
}> => ({
  loading: {
    label: 'Carregando…',
    color: 'bg-muted text-muted-foreground',
    Icon: Loader2,
    description: `Verificando o status do seu documento.`,
  },
  none: {
    label: 'Não enviado',
    color: 'bg-muted text-muted-foreground border border-border',
    Icon: ShieldQuestion,
    description: `Você ainda não enviou seu ${docLabel}. Isso desbloqueia o status ONLINE.`,
  },
  pending: {
    label: 'Pendente',
    color: 'bg-amber-500/10 text-amber-700 border border-amber-500/30',
    Icon: ShieldAlert,
    description: 'Documento recebido. Aguardando confirmação do sistema.',
  },
  review: {
    label: 'Em análise',
    color: 'bg-blue-500/10 text-blue-700 border border-blue-500/30',
    Icon: Loader2,
    description: 'Estamos validando os dados informados. Você será notificado quando concluído.',
  },
  verified: {
    label: 'Verificado',
    color: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30',
    Icon: ShieldCheck,
    description: 'Identidade verificada. Seu perfil aparece com selo de confiança.',
  },
});

export const VerificationStatusBadge = ({
  userId, variant = 'default', showHistory = false, docKind, hideWhenNone, className,
}: Props) => {
  const [state, setState] = useState<VerificationState>('loading');
  const [hasDoc, setHasDoc] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setState('none'); return; }
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const computeFromRows = (prov: ProviderRow | null, taxIdFilled: boolean) => {
      if (!prov) {
        setState(taxIdFilled ? 'pending' : 'none');
        return;
      }
      if (prov.status === 'active' && prov.community_verified_at) {
        setState('verified');
        setLastUpdate(prov.community_verified_at);
      } else if (prov.status === 'active') {
        setState('verified');
      } else if (taxIdFilled && prov.status === 'pending') {
        // Estado intermediário entre "pending bruto" e "review" — usamos pending.
        setState('pending');
      } else if (taxIdFilled) {
        setState('review');
      } else {
        setState('none');
      }
    };

    (async () => {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('tax_id')
          .eq('id', userId)
          .maybeSingle();
        const taxIdFilled = !!(prof as any)?.tax_id;
        if (alive) setHasDoc(taxIdFilled);

        const { data: prov } = await supabase
          .from('providers')
          .select('id, status, community_verified_at')
          .eq('user_id', userId)
          .maybeSingle();

        if (!alive) return;
        computeFromRows(prov as ProviderRow | null, taxIdFilled);

        if (prov?.id) {
          channel = supabase
            .channel(`verification-status:${prov.id}`)
            .on('postgres_changes',
              { event: 'UPDATE', schema: 'public', table: 'providers', filter: `id=eq.${prov.id}` },
              (payload: any) => {
                if (!alive) return;
                const next: ProviderRow = {
                  id: prov.id,
                  status: payload.new?.status ?? null,
                  community_verified_at: payload.new?.community_verified_at ?? null,
                };
                computeFromRows(next, taxIdFilled);
                setLastUpdate(new Date().toISOString());
              })
            .subscribe();
        }
      } catch {
        if (alive) setState('none');
      }
    })();

    return () => {
      alive = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId]);

  const STATE_META = buildStateMeta(resolveDocLabel(docKind));
  // Em fluxos como o upsell do wizard, o estado 'none' duplica info já evidente.
  if (hideWhenNone && state === 'none') return null;
  const meta = STATE_META[state];
  const Icon = meta.Icon;
  const isSpinning = state === 'loading' || state === 'review';

  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold',
        meta.color,
        className,
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', isSpinning && 'animate-spin')} />
      <span>{meta.label}</span>
    </Badge>
  );

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">{meta.description}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {badge}
        {hasDoc && state !== 'verified' && (
          <span className="text-[11px] text-muted-foreground">
            Documento já enviado
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{meta.description}</p>
      {showHistory && lastUpdate && (
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <History className="h-3 w-3" />
          Última atualização: {new Date(lastUpdate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      )}
    </div>
  );
};

export default VerificationStatusBadge;

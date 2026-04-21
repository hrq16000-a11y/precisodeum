import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, CheckCircle2, Circle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Status {
  account_age_ok: boolean;
  onboarding_ok: boolean;
  conversion_ok: boolean;
  is_verified: boolean;
  account_age_days: number;
  verified_since: string | null;
}

/**
 * Painel do dashboard mostrando os 3 requisitos do selo Verificado pela Comunidade.
 */
const CommunityVerifiedStatus = ({ className = '' }: { className?: string }) => {
  const { user } = useAuth();

  const { data: status, isLoading } = useQuery({
    queryKey: ['community-verified-status', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Status | null> => {
      const { data, error } = await supabase.rpc('get_provider_verification_status', {
        _user_id: user!.id,
      } as any);
      if (error) return null;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as Status) ?? null;
    },
    staleTime: 1000 * 60 * 2,
  });

  if (isLoading || !status) return null;

  const items = [
    {
      ok: status.account_age_ok,
      label: 'Mais de 30 dias na plataforma',
      hint: status.account_age_ok
        ? `${status.account_age_days} dias de cadastro`
        : `Faltam ${Math.max(0, 30 - status.account_age_days)} dia(s)`,
    },
    {
      ok: status.onboarding_ok,
      label: 'Checklist de onboarding completo',
      hint: status.onboarding_ok ? 'Concluído' : 'Complete o checklist "Primeiro Lead Garantido"',
    },
    {
      ok: status.conversion_ok,
      label: 'Pelo menos 1 cliente atendido',
      hint: status.conversion_ok ? 'Conversão registrada' : 'Aguardando 1º clique no WhatsApp ou conversão',
    },
  ];

  const completed = items.filter(i => i.ok).length;

  return (
    <div className={`rounded-2xl border ${status.is_verified ? 'border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-card' : 'border-border bg-card'} p-5 shadow-card ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${status.is_verified ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'}`}>
          <BadgeCheck className="h-6 w-6" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display text-base font-bold text-foreground">
              {status.is_verified ? 'Verificado pela Comunidade' : 'Selo Verificado pela Comunidade'}
            </h3>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                  <p className="text-muted-foreground">
                    O selo reflete a atividade na plataforma — não atesta responsabilidade jurídica nem qualificação profissional.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {status.is_verified
              ? `Você tem o selo desde ${status.verified_since ? new Date(status.verified_since).toLocaleDateString('pt-BR') : '—'}.`
              : `${completed} de 3 requisitos atendidos. Cumpra todos para ganhar o selo automaticamente.`}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2.5">
            {it.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-tight ${it.ok ? 'text-foreground' : 'text-muted-foreground'}`}>
                {it.label}
              </p>
              <p className="text-[11px] text-muted-foreground">{it.hint}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CommunityVerifiedStatus;

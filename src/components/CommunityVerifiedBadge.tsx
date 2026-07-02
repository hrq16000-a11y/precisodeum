import { BadgeCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

/**
 * "Verificado pela Comunidade" — selo automático.
 * Exibido quando o profissional cumpre 3 requisitos:
 * 1) Conta com mais de 30 dias na plataforma
 * 2) Pelo menos 1 lead convertido (clique no WhatsApp ou conversão manual)
 * 3) Checklist de onboarding 100% concluído
 *
 * IMPORTANTE: o selo reflete atividade na plataforma, não responsabilidade jurídica.
 */
const CommunityVerifiedBadge = ({ size = 'sm', showLabel = false, className = '' }: Props) => {
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const padding = showLabel ? 'px-2 py-0.5' : 'p-0.5';

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 rounded-full bg-blue-500/10 ${padding} text-[11px] font-semibold text-blue-600 dark:text-blue-400 ${className}`}
            aria-label="Verificado pela Comunidade"
          >
            <BadgeCheck className={`${iconSize} fill-blue-500/20`} strokeWidth={2.5} />
            {showLabel && <span>Verificado</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          <p className="font-semibold mb-1">Verificado pela Comunidade</p>
          <p className="text-muted-foreground">
            Selo automático para perfis com mais de 30 dias, onboarding completo e pelo menos 1 cliente atendido.
          </p>
          <p className="mt-1.5 text-[10px] italic text-muted-foreground/80">
            Reflete a atividade na plataforma — não atesta responsabilidade jurídica nem qualificação profissional.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CommunityVerifiedBadge;

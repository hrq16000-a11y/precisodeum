import { ShieldCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

/**
 * Selo "Profissional Top" — exibido quando `providers.is_verified = true`.
 *
 * Critérios objetivos (recomputados por trigger ao alterar perfil ou serviços):
 *   - Perfil mínimo: foto + descrição (>=30) + 1 serviço cadastrado
 *   - Contato/Geo:   WhatsApp válido + cidade + GPS (lat/lng)
 *
 * Override admin: admin pode marcar/desmarcar manualmente via
 * RPC `admin_set_provider_verified` (registra autor + motivo no audit_log).
 */
const TopProfessionalBadge = ({ size = 'sm', showLabel = false, className = '' }: Props) => {
  const iconSize =
    size === 'sm' ? 'h-3.5 w-3.5' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5';
  const padding = showLabel ? 'px-2 py-0.5' : 'p-0.5';

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/15 to-amber-400/10 ring-1 ring-amber-500/30 ${padding} text-[11px] font-semibold text-amber-700 dark:text-amber-300 ${className}`}
            aria-label="Profissional Top — identidade verificada"
          >
            <ShieldCheck className={`${iconSize} fill-amber-500/20`} strokeWidth={2.5} />
            {showLabel && <span>Profissional Top</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          <p className="font-semibold mb-1">Profissional Top</p>
          <p className="text-muted-foreground">
            Perfil completo (foto, descrição, serviço) e contato/localização válidos. Veja os critérios cumpridos no perfil público.
          </p>
          <p className="mt-1.5 text-[10px] italic text-muted-foreground/80">
            O selo reflete maturidade e auto-verificação — não atesta qualificação técnica nem responsabilidade jurídica.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default TopProfessionalBadge;

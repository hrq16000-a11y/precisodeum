import { CheckCircle2, XCircle, Shield, ShieldCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface VerificationRules {
  min_services: number;
  min_albums: number;
  min_reviews: number;
  min_rating: number;
  require_photo: boolean;
  require_cnpj: boolean;
  require_city: boolean;
}

interface ProviderData {
  services_count: number;
  portfolio_album_count: number;
  review_count: number;
  rating_avg: number;
  photo_url: string | null;
  cnpj: string | null;
  city: string;
}

interface Props {
  provider: ProviderData;
  rules: VerificationRules;
  compact?: boolean;
}

const ProviderVerifiedChecklist = ({ provider, rules, compact = false }: Props) => {
  const checks = [
    { label: 'CNPJ', met: !rules.require_cnpj || !!provider.cnpj?.trim(), required: rules.require_cnpj },
    { label: 'Cidade', met: !rules.require_city || !!provider.city?.trim(), required: rules.require_city },
    { label: 'Foto', met: !rules.require_photo || !!provider.photo_url, required: rules.require_photo },
    { label: `${rules.min_services}+ serviços`, met: provider.services_count >= rules.min_services, required: rules.min_services > 0 },
    { label: `${rules.min_albums}+ álbuns`, met: provider.portfolio_album_count >= rules.min_albums, required: rules.min_albums > 0 },
    { label: `${rules.min_reviews}+ avaliações`, met: provider.review_count >= rules.min_reviews, required: rules.min_reviews > 0 },
    { label: `Nota ≥ ${rules.min_rating}`, met: provider.rating_avg >= rules.min_rating, required: rules.min_rating > 0 },
  ].filter(c => c.required);

  const allMet = checks.every(c => c.met);
  const metCount = checks.filter(c => c.met).length;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`gap-1 text-[10px] cursor-help ${
                allMet
                  ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:bg-emerald-900/20'
                  : 'border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:bg-amber-900/20'
              }`}
            >
              {allMet ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
              {allMet ? 'Verificado' : `${metCount}/${checks.length}`}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-semibold text-xs mb-1.5">
                {allMet ? 'Todos os critérios atendidos' : 'Critérios pendentes'}
              </p>
              {checks.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  {c.met ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3 w-3 text-destructive shrink-0" />
                  )}
                  <span className={c.met ? 'text-muted-foreground' : 'text-foreground font-medium'}>{c.label}</span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 mb-2">
        {allMet ? (
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
        ) : (
          <Shield className="h-4 w-4 text-amber-500" />
        )}
        <span className="text-xs font-semibold">
          {allMet ? 'Perfil Verificado' : `${metCount}/${checks.length} critérios`}
        </span>
      </div>
      {checks.map((c, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          {c.met ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
          )}
          <span className={c.met ? 'text-muted-foreground' : 'text-foreground font-medium'}>{c.label}</span>
        </div>
      ))}
    </div>
  );
};

export default ProviderVerifiedChecklist;

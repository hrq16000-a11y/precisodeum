import { ShieldCheck, Check, X, ShieldAlert, UserCog } from 'lucide-react';
import { useProviderVerifiedDetails, CRITERIA_LABELS, flattenCriteria } from '@/hooks/useProviderVerifiedDetails';

interface Props {
  providerId: string;
  /** Mostra o card mesmo quando o profissional ainda NÃO é Top, listando o que falta. */
  showWhenNotVerified?: boolean;
}

/**
 * Seção "Por que é Profissional Top" — explica ao visitante quais critérios
 * objetivos foram cumpridos para o selo (ou quais ainda faltam).
 *
 * Quando o admin marca manualmente (verified_manual=true), exibe uma nota de
 * "verificação manual pelo admin" com o motivo registrado.
 */
const TopProfessionalCriteriaCard = ({ providerId, showWhenNotVerified = false }: Props) => {
  const { data, loading } = useProviderVerifiedDetails(providerId);
  if (loading || !data) return null;
  if (!data.isVerified && !showWhenNotVerified) return null;

  const flat = flattenCriteria(data.criteria);
  const profileItems = CRITERIA_LABELS.filter((c) => c.group === 'profile');
  const contactItems = CRITERIA_LABELS.filter((c) => c.group === 'contact');

  const StatusIcon = data.isVerified ? ShieldCheck : ShieldAlert;
  const headerColor = data.isVerified
    ? 'from-amber-500/10 to-amber-400/5 ring-amber-500/30 text-amber-700 dark:text-amber-300'
    : 'from-muted to-muted/50 ring-border text-muted-foreground';

  return (
    <section
      aria-label="Critérios do selo Profissional Top"
      className={`mt-4 rounded-xl border border-border bg-gradient-to-br ${headerColor} ring-1 p-4 sm:p-5`}
    >
      <header className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/80 ring-1 ring-current/20">
          <StatusIcon className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-foreground">
            {data.isVerified ? 'Profissional Top' : 'Para se tornar Profissional Top'}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
            {data.verifiedReason || 'Critérios objetivos baseados no perfil e contato do prestador.'}
          </p>

          {data.verifiedManual && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-background/70 px-2 py-1 text-[11px] font-medium text-foreground ring-1 ring-border">
              <UserCog className="h-3.5 w-3.5" />
              Verificação manual confirmada pela administração
            </p>
          )}
        </div>
      </header>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <CriteriaGroup
          title="Perfil mínimo completo"
          items={profileItems}
          flat={flat}
        />
        <CriteriaGroup
          title="Contato e localização"
          items={contactItems}
          flat={flat}
        />
      </div>

      <p className="mt-4 text-[11px] italic text-muted-foreground/90">
        O selo reflete completude do cadastro — não atesta qualificação técnica nem responsabilidade jurídica.
      </p>
    </section>
  );
};

const CriteriaGroup = ({
  title,
  items,
  flat,
}: {
  title: string;
  items: Array<{ key: string; label: string }>;
  flat: Record<string, boolean>;
}) => (
  <div className="rounded-lg bg-background/60 p-3 ring-1 ring-border">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    <ul className="mt-2 space-y-1.5">
      {items.map((item) => {
        const ok = !!flat[item.key];
        return (
          <li key={item.key} className="flex items-center gap-2 text-sm">
            {ok ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
            ) : (
              <X className="h-4 w-4 shrink-0 text-muted-foreground/60" strokeWidth={2.5} />
            )}
            <span className={ok ? 'text-foreground' : 'text-muted-foreground line-through'}>{item.label}</span>
          </li>
        );
      })}
    </ul>
  </div>
);

export default TopProfessionalCriteriaCard;

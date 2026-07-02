/**
 * GpsConsentNotice — bloco explicativo (consentimento informado) que mostra
 * exatamente o que o GPS vai preencher em cada nível de precisão e oferece
 * a saída "Continuar sem GPS".
 *
 * - Aproximada (IP / GPS >100m): UF + cidade-base + bairro provável.
 * - Precisa (GPS ≤100m):         UF + cidade-base + bairro confiável + lat/lng.
 *
 * NÃO dispara permissão sozinho — apenas informa. O clique no botão GPS
 * (controlado pelo pai) é que aciona `navigator.geolocation`.
 *
 * A11y: `role="region"` + `aria-labelledby` para que leitores de tela
 * anunciem o título do bloco; lista de itens marcada com `<ul>`.
 */
import { Info, MapPin, Crosshair, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  /** Acionado quando o usuário escolhe seguir sem GPS. */
  onSkip?: () => void;
  /** Texto do botão de skip (default: "Continuar sem GPS"). */
  skipLabel?: string;
  /** Quando true, omite o botão de skip (apenas exibe a explicação). */
  hideSkip?: boolean;
  className?: string;
}

export default function GpsConsentNotice({
  onSkip,
  skipLabel = 'Continuar sem GPS',
  hideSkip = false,
  className = '',
}: Props) {
  return (
    <section
      role="region"
      aria-labelledby="gps-consent-title"
      data-testid="gps-consent-notice"
      className={`rounded-xl border border-bet-amber-border bg-bet-amber-soft/40 p-3 text-xs text-foreground ${className}`}
    >
      <header className="mb-2 flex items-center gap-2">
        <Info className="h-4 w-4 flex-shrink-0 text-bet-amber-fg" aria-hidden />
        <h3 id="gps-consent-title" className="font-semibold leading-tight">
          O que será preenchido com sua localização
        </h3>
      </header>

      <ul className="space-y-1.5 leading-snug">
        <li className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <strong>Aproximada</strong>: UF, cidade-base e bairro provável.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Crosshair className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-bet-green-fg" aria-hidden />
          <span>
            <strong>Precisa</strong>: UF, cidade-base, bairro confiável e
            coordenadas (para distância no ranking).
          </span>
        </li>
      </ul>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Você pode editar qualquer campo depois — o GPS apenas <em>sugere</em> o que
        ainda está em branco. Nada é enviado sem seu consentimento.
      </p>

      {!hideSkip && onSkip && (
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSkip}
            data-testid="gps-consent-skip"
            className="h-7 gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" aria-hidden /> {skipLabel}
          </Button>
        </div>
      )}
    </section>
  );
}

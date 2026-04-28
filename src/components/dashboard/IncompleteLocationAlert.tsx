/**
 * IncompleteLocationAlert — Banner persistente no Dashboard quando o
 * cadastro está incompleto em localização (bairro padrão "Centro" ou
 * sem GPS). Avisa que isso reduz a visibilidade nas buscas.
 *
 * Dispensável (X) por sessão — guarda em sessionStorage para não atrapalhar.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';

const DISMISS_KEY = 'incomplete_location_alert_dismissed';

interface Props {
  provider: any;
}

export default function IncompleteLocationAlert({ provider }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  });

  if (!provider || dismissed) return null;

  const isDefaultCentro = provider.neighborhood_source === 'default_centro';
  const noCoords = !(typeof provider.latitude === 'number' && typeof provider.longitude === 'number');

  if (!isDefaultCentro && !noCoords) return null;

  const issues: string[] = [];
  if (isDefaultCentro) issues.push('bairro real');
  if (noCoords) issues.push('coordenadas GPS');

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div
      role="alert"
      className="relative mb-4 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-50 to-orange-50 p-4 dark:from-amber-500/10 dark:to-orange-500/10"
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dispensar aviso"
        className="absolute right-2 top-2 rounded-full p-1 text-amber-700/60 hover:bg-amber-500/15 hover:text-amber-700"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-bold text-foreground">
            Seu cadastro está incompleto e isso reduz sua visibilidade
          </p>
          <p className="text-xs text-muted-foreground">
            Falta preencher: <strong className="text-foreground">{issues.join(' e ')}</strong>.
            Clientes próximos podem não te encontrar nas buscas.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              to="/dashboard/localizacao-guiada"
              className="inline-flex h-9 items-center rounded-md bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-3 text-xs font-bold text-white hover:opacity-95"
            >
              Completar agora <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
            <Link
              to="/dashboard/auditoria-bairro"
              className="inline-flex h-9 items-center rounded-md border border-amber-500/40 bg-white px-3 text-xs font-bold text-amber-700 hover:bg-amber-50 dark:bg-transparent"
            >
              Entender o impacto
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

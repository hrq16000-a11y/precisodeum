/**
 * ProfileLocationChecklist
 *
 * Mostra ao prestador o que falta para completar a localização e desbloquear
 * o badge "Atende no seu bairro" + ranking de proximidade.
 *
 * Itens checados:
 *  - Cidade preenchida
 *  - Bairro digitado pelo usuário (não o default "Centro")
 *  - Coordenadas GPS (latitude/longitude)
 *
 * Renderiza CTA para a página de edição de perfil quando algo falta.
 * Quando tudo está OK, mostra confirmação verde.
 */
import { CheckCircle2, AlertCircle, MapPin, Navigation, Building2, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface Props {
  provider: {
    city?: string | null;
    state?: string | null;
    neighborhood?: string | null;
    neighborhood_source?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    status?: string | null;
    geo_source?: string | null;
    geo_source_confidence?: number | null;
  } | null | undefined;
}

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  unlocks?: string;
}

export default function ProfileLocationChecklist({ provider }: Props) {
  if (!provider) return null;

  // Guard anti-zumbi: prestadores/empresas com cadastro já ativo não
  // devem ver checklist de localização — caso contrário o card aparece
  // como "pendência fantasma" mesmo após aprovação no Wizard.
  const status = String(provider.status || '').toLowerCase();
  if (status === 'active') return null;

  // Defesa em profundidade: providers legados podem chegar com tipos
  // inesperados (números, objetos, arrays) em campos string. Coerção segura.
  const safeStr = (v: unknown): string =>
    typeof v === 'string' ? v.trim() : '';

  const cityStr = safeStr(provider.city);
  const stateStr = safeStr(provider.state);
  const neighborhoodStr = safeStr(provider.neighborhood);
  const neighborhoodSourceStr = safeStr(provider.neighborhood_source);
  const geoSourceStr = safeStr(provider.geo_source);

  const hasCity = cityStr.length > 0;
  const hasState = stateStr.length === 2;
  const hasUserNeighborhood =
    neighborhoodStr.length > 0 && neighborhoodSourceStr === 'user';
  const hasCoords =
    typeof provider.latitude === 'number' &&
    typeof provider.longitude === 'number' &&
    Number.isFinite(provider.latitude) &&
    Number.isFinite(provider.longitude);

  const items: ChecklistItem[] = [
    {
      key: 'city',
      label: 'Cidade e estado',
      done: hasCity && hasState,
      hint: 'Necessário para aparecer nas buscas da sua região.',
      icon: Building2,
      unlocks: 'Buscas por cidade',
    },
    {
      key: 'neighborhood',
      label: 'Bairro real (não "Centro" automático)',
      done: hasUserNeighborhood,
      hint:
        provider.neighborhood_source === 'default_centro'
          ? 'Seu bairro foi preenchido como "Centro" automaticamente. Edite para o bairro real.'
          : 'Informe o bairro onde você atende.',
      icon: MapPin,
      unlocks: 'Selo "Atende no seu bairro"',
    },
    {
      key: 'coords',
      label: 'Coordenadas GPS',
      done: hasCoords,
      hint: hasCoords && provider.geo_source === 'gps' && typeof provider.geo_source_confidence === 'number'
        ? `GPS ${provider.geo_source_confidence <= 100 ? 'preciso' : 'aproximado'} (±${Math.round(provider.geo_source_confidence)}m).`
        : 'Permite ordenar por proximidade real (Haversine) e calcular distância exata.',
      icon: Navigation,
      unlocks: 'Ranking por proximidade',
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  const allDone = doneCount === total;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Localização do seu perfil
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allDone
              ? 'Tudo certo! Você está visível por proximidade.'
              : `${doneCount} de ${total} itens completos.`}
          </p>
        </div>
        {allDone ? (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Completo
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-3 w-3" /> Incompleto
          </span>
        )}
      </div>

      {/* Progresso visual */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-primary transition-all duration-500"
          style={{ width: `${(doneCount / total) * 100}%` }}
        />
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.key}
              className={`flex items-start gap-3 rounded-md border p-2.5 ${
                item.done
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-border bg-card'
              }`}
            >
              <div
                className={`shrink-0 mt-0.5 ${
                  item.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                }`}
              >
                {item.done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5 break-words">{item.hint}</div>
                {item.unlocks && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                    Desbloqueia: {item.unlocks}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {!allDone && (
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Button asChild size="sm" className="flex-1">
            <Link to="/dashboard/localizacao-guiada">
              Completar localização
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link to="/dashboard/auditoria-bairro">
              Como o selo é calculado
            </Link>
          </Button>
        </div>
      )}
      {allDone && (
        <div className="mt-4">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/dashboard/auditoria-bairro">
              Ver critérios do selo
            </Link>
          </Button>
        </div>
      )}
    </Card>
  );
}

/**
 * MetroExpandSuggestion — sugestão 1-clique para expandir o atendimento
 * para a Região Metropolitana da cidade selecionada.
 *
 * Aparece quando:
 *  • O prestador escolheu uma cidade-polo de uma RM mapeada (ex.: Curitiba),
 *  • E o `serviceRadius` ainda NÃO está em 'metro'.
 *
 * Ao confirmar, sobe o raio para 'metro' e chama o callback opcional
 * `onMembersList` com os municípios satélites (para uso futuro em chips
 * de revisão / SEO local).
 */

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { MapPinned, Sparkles } from 'lucide-react';
import { findMetroByPole, type MetroRegion } from '@/lib/metroRegions';
import { normalize } from '@/lib/normalize';

interface Props {
  selectedCity: string | null | undefined;
  serviceRadius: string;
  onExpandToMetro: () => void;
  onMembersList?: (members: string[]) => void;
}

export default function MetroExpandSuggestion({
  selectedCity,
  serviceRadius,
  onExpandToMetro,
  onMembersList,
}: Props) {
  const metro: MetroRegion | null = useMemo(() => {
    if (!selectedCity) return null;
    return findMetroByPole(normalize(selectedCity));
  }, [selectedCity]);

  if (!metro || serviceRadius === 'metro') return null;
  // Ignora RM com apenas 1 município (não há ganho de alcance)
  if (metro.members.length <= 1) return null;

  const satelliteCount = metro.members.length - 1;
  // Estimativa de ganho conservadora: cada cidade-satélite acrescenta ~12% de
  // alcance relativo ao polo (heurística — não é dado real, é pedagógica).
  const estimatedGainPct = Math.min(80, satelliteCount * 12);

  const handleClick = () => {
    onExpandToMetro();
    if (onMembersList) onMembersList(metro.members);
  };

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-700 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">
            Atender também a Região Metropolitana?
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Sua cidade ({selectedCity}) é polo de uma RM com {satelliteCount} município{satelliteCount > 1 ? 's' : ''} satélite{satelliteCount > 1 ? 's' : ''} no IBGE.
            Aceitar pode aumentar seu alcance em até <strong className="text-amber-700 dark:text-amber-300">{estimatedGainPct}%</strong> nas buscas locais.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {metro.members.slice(1, 7).map((m) => (
          <span key={m} className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] text-amber-900 dark:text-amber-100">
            {m}
          </span>
        ))}
        {metro.members.length > 7 && (
          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] text-amber-900 dark:text-amber-100">
            +{metro.members.length - 7}
          </span>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleClick}
        className="h-8 w-full border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
      >
        <MapPinned className="h-3 w-3 mr-1" />
        Sim, expandir para a RM
      </Button>
    </div>
  );
}

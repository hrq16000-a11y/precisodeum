/**
 * Matriz de slots de patrocinador do MODO GUIA — posição × cidade.
 *
 * Ferramenta de preview interna: mostra quais slots estariam ativos em cada
 * combinação de página/cidade e permite SIMULAR overrides (adicionar/remover
 * posições) apenas em memória. Nada é persistido e o portal real nunca é
 * alterado — a simulação roda sobre `resolveSponsorSlots` com overrides locais.
 */
import { useMemo, useState } from 'react';
import { Check, Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { POSITION_CONFIG, POSITION_KEYS } from '@/config/sponsorPositions';
import {
  resolveSponsorSlots,
  SPONSOR_PAGE_KINDS,
  type SponsorPageKind,
} from '@/config/sponsorSlots';

const DEFAULT_CITIES = ['curitiba', 'sao-jose-dos-pinhais', 'pinhais', 'colombo'];

type Simulation = Record<string, { add: string[]; remove: string[] }>;

const emptySim = () => ({ add: [] as string[], remove: [] as string[] });

export interface GuideSlotMatrixProps {
  cities?: string[];
  defaultPageKind?: SponsorPageKind;
}

export function GuideSlotMatrix({
  cities: initialCities = DEFAULT_CITIES,
  defaultPageKind = 'category_city',
}: GuideSlotMatrixProps) {
  const [pageKind, setPageKind] = useState<SponsorPageKind>(defaultPageKind);
  const [cities, setCities] = useState<string[]>(initialCities);
  const [newCity, setNewCity] = useState('');
  const [simulation, setSimulation] = useState<Simulation>({});

  const matrix = useMemo(() => {
    return cities.map((city) => {
      const base = resolveSponsorSlots(pageKind, { citySlug: city, guideMode: true });
      const sim = simulation[city] ?? emptySim();
      const active = new Set(base.map((s) => s.position));
      sim.remove.forEach((p) => active.delete(p));
      sim.add.forEach((p) => active.add(p));
      return {
        city,
        baseline: base.map((s) => s.position),
        active,
        slots: POSITION_KEYS.filter((p) => active.has(p)),
      };
    });
  }, [cities, pageKind, simulation]);

  const toggle = (city: string, position: string, isActive: boolean) => {
    setSimulation((prev) => {
      const current = prev[city] ?? emptySim();
      const next = {
        add: current.add.filter((p) => p !== position),
        remove: current.remove.filter((p) => p !== position),
      };
      if (isActive) next.remove.push(position);
      else next.add.push(position);
      return { ...prev, [city]: next };
    });
  };

  const hasSimulation = Object.values(simulation).some((s) => s.add.length || s.remove.length);

  return (
    <section
      aria-labelledby="slot-matrix-title"
      className="space-y-4"
      data-testid="guide-slot-matrix"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="slot-matrix-title" className="text-xl font-semibold">
          Slots por posição e cidade
        </h2>
        {hasSimulation && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSimulation({})}
            data-testid="slot-matrix-reset"
          >
            <RotateCcw className="mr-1.5 h-4 w-4" /> Restaurar configuração real
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {SPONSOR_PAGE_KINDS.map((kind) => (
          <Button
            key={kind}
            size="sm"
            variant={kind === pageKind ? 'default' : 'outline'}
            onClick={() => setPageKind(kind)}
            data-testid={`slot-matrix-page-${kind}`}
          >
            {kind}
          </Button>
        ))}
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const slug = newCity.trim().toLowerCase();
          if (slug && !cities.includes(slug)) setCities([...cities, slug]);
          setNewCity('');
        }}
      >
        <Input
          value={newCity}
          onChange={(e) => setNewCity(e.target.value)}
          placeholder="simular outra cidade (slug)"
          aria-label="Simular outra cidade"
          className="max-w-xs"
        />
        <Button type="submit" size="sm" variant="outline">
          <Plus className="mr-1.5 h-4 w-4" /> Adicionar cidade
        </Button>
      </form>

      <Card className="w-full max-w-full overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">
            Slots de patrocinador ativos por posição e cidade no modo guia
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="p-3 text-left font-medium">
                Posição
              </th>
              {matrix.map((row) => (
                <th key={row.city} scope="col" className="p-3 text-left font-medium">
                  {row.city}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {POSITION_KEYS.map((position) => (
              <tr key={position} className="border-b border-border/60 last:border-0">
                <th scope="row" className="p-3 text-left font-normal">
                  <span className="block font-medium">{POSITION_CONFIG[position].label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {POSITION_CONFIG[position].dimensions}
                  </span>
                </th>
                {matrix.map((row) => {
                  const isActive = row.active.has(position);
                  const isSimulated = row.baseline.includes(position) !== isActive;
                  return (
                    <td key={row.city} className="p-3 align-middle">
                      <Button
                        size="sm"
                        variant={isActive ? 'default' : 'outline'}
                        onClick={() => toggle(row.city, position, isActive)}
                        aria-pressed={isActive}
                        aria-label={`${isActive ? 'Desativar' : 'Ativar'} ${POSITION_CONFIG[position].label} em ${row.city}`}
                        data-testid={`slot-cell-${row.city}-${position}`}
                        data-active={isActive ? 'true' : 'false'}
                        data-simulated={isSimulated ? 'true' : 'false'}
                        className="min-w-[5.5rem] justify-start"
                      >
                        {isActive ? (
                          <Check className="mr-1.5 h-4 w-4" />
                        ) : (
                          <Minus className="mr-1.5 h-4 w-4" />
                        )}
                        {isActive ? 'ativo' : 'off'}
                      </Button>
                      {isSimulated && (
                        <Badge variant="secondary" className="ml-2 align-middle text-[10px]">
                          simulado
                        </Badge>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Simulação local: nenhuma alteração é salva nem aplicada ao portal em produção.
      </p>
    </section>
  );
}

export default GuideSlotMatrix;

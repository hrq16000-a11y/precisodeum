/**
 * ServiceCityPicker — seletor controlado de "Cidades atendidas" para o
 * Wizard. Suporta:
 *  - Cidades individuais (autocomplete IBGE, mesmo componente do app).
 *  - Adição em 1 clique de "Região Metropolitana de {polo}", quando a
 *    cidade-base do profissional tem RM cadastrada em metroRegions.
 *  - Tag visual diferenciada para a label regional (não confunde com cidade).
 *
 * Sem texto livre. Tudo passa pelo catálogo IBGE ou pelo dicionário de RMs.
 */
import { useMemo } from 'react';
import { Plus, X, MapPin, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CityAutocomplete from '@/components/CityAutocomplete';
import { findMetroByPole, getMetroMembers } from '@/lib/metroRegions';
import { normalize } from '@/lib/normalize';

interface Props {
  /** Cidade-base do profissional (providers.city). */
  baseCity: string | null | undefined;
  /** UF do profissional (providers.state). Restringe o autocomplete. */
  baseState: string | null | undefined;
  /** Lista atual de cidades atendidas (string livre — vinda do legado). */
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
}

/** Etiqueta amigável para uma RM, dado o polo (ex.: "curitiba" → "Região Metropolitana de Curitiba"). */
function regionLabelFromPole(pole: string): string {
  // Capitaliza pole bem simples (curitiba → Curitiba; saopaulo → São Paulo é tratado fora).
  const PRETTY: Record<string, string> = {
    curitiba: 'Curitiba',
    saopaulo: 'São Paulo',
    riodejaneiro: 'Rio de Janeiro',
    belohorizonte: 'Belo Horizonte',
    portoalegre: 'Porto Alegre',
    recife: 'Recife',
    fortaleza: 'Fortaleza',
    salvador: 'Salvador',
    goiania: 'Goiânia',
    vitoria: 'Vitória',
    florianopolis: 'Florianópolis',
    belem: 'Belém',
    natal: 'Natal',
    saoluis: 'São Luís',
    joaopessoa: 'João Pessoa',
    maceio: 'Maceió',
    cuiaba: 'Cuiabá',
    campogrande: 'Campo Grande',
    campinas: 'Campinas',
    manaus: 'Manaus',
    brasilia: 'Brasília',
    santos: 'Baixada Santista',
  };
  return `Região Metropolitana de ${PRETTY[pole] ?? pole}`;
}

const REGION_PREFIX = 'Região Metropolitana de ';
const isRegionTag = (s: string) => s.startsWith(REGION_PREFIX) || s === 'Baixada Santista';

export const ServiceCityPicker = ({
  baseCity,
  baseState,
  value,
  onChange,
  max = 5,
}: Props) => {
  const baseNorm = normalize(baseCity || '');

  // Detecta se a cidade-base é polo de alguma RM.
  const metro = useMemo(() => (baseNorm ? findMetroByPole(baseNorm) : null), [baseNorm]);
  const regionLabel = metro ? regionLabelFromPole(metro.pole) : null;

  const hasRegion = regionLabel ? value.includes(regionLabel) : false;
  const remaining = Math.max(0, max - value.length);

  const addCity = (city: string) => {
    const v = (city || '').trim();
    if (!v) return;
    if (value.includes(v)) return;
    if (value.length >= max) return;
    onChange([...value, v]);
  };

  const removeAt = (item: string) => {
    onChange(value.filter((c) => c !== item));
  };

  const addRegion = () => {
    if (!regionLabel || !metro) return;
    if (hasRegion) return;
    // Adiciona a tag regional + (se houver espaço) cidades-membro mais próximas (até completar `max`).
    // Para evitar inflar demais, adicionamos apenas a TAG. As cidades-membro
    // são ranqueadas no backend automaticamente via metroRegions.
    if (value.length >= max) return;
    onChange([...value, regionLabel]);
  };

  const expandRegionMembers = () => {
    if (!metro) return;
    const PRETTY: Record<string, string> = {};
    const members = getMetroMembers(baseCity || '');
    // Heurística: pega até `max - value.length` membros (excluindo o polo, que já é a cidade-base).
    const candidates = members
      .filter((m) => m !== baseNorm)
      .map((m) => PRETTY[m] || (m.charAt(0).toUpperCase() + m.slice(1)));
    const next = [...value];
    for (const c of candidates) {
      if (next.length >= max) break;
      if (!next.includes(c)) next.push(c);
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" /> Cidades atendidas{' '}
        <span className="font-normal normal-case text-muted-foreground/70">(até {max})</span>
      </span>

      <div className="flex gap-2">
        <div className="flex-1">
          <CityAutocomplete
            value={{ city: '', state: baseState || '' }}
            onChange={(next) => addCity(next.city)}
            placeholder={baseState ? 'Ex: Curitiba' : 'Defina sua UF antes'}
            stateFilter={baseState || undefined}
            disabled={value.length >= max || !baseState}
            statusText={baseState ? `Selecione cidades de ${baseState}` : 'A UF do perfil define as cidades exibidas'}
          />
        </div>
        <Button type="button" variant="outline" disabled className="h-11 w-11 p-0" aria-hidden>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Sugestão de Região Metropolitana */}
      {regionLabel && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-2 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-accent" />
              <div>
                <p className="font-medium text-foreground">{regionLabel}</p>
                <p className="text-[10px] text-muted-foreground">
                  Atende {metro!.members.length} cidades da região.
                </p>
              </div>
            </div>
            {hasRegion ? (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Check className="h-3 w-3" /> Adicionada
              </Badge>
            ) : (
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addRegion}
                  disabled={value.length >= max}
                  className="h-7 px-2 text-[11px]"
                >
                  Adicionar região
                </Button>
                {remaining > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={expandRegionMembers}
                    className="h-6 px-2 text-[10px]"
                  >
                    Adicionar {Math.min(remaining, metro!.members.length - 1)} cidades
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!baseState && (
        <p className="text-[11px] text-muted-foreground">
          Escolha seu estado na etapa anterior para limitar as cidades automaticamente.
        </p>
      )}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((c) => {
            const region = isRegionTag(c);
            return (
              <Badge
                key={c}
                variant={region ? 'default' : 'secondary'}
                className={`gap-1 ${region ? 'bg-accent/15 text-foreground hover:bg-accent/20' : ''}`}
              >
                {region && <Sparkles className="h-3 w-3" />}
                {c}
                <button
                  type="button"
                  onClick={() => removeAt(c)}
                  className="hover:text-destructive"
                  aria-label={`Remover ${c}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ServiceCityPicker;

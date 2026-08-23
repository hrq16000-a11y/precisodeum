import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDebounce } from '@/hooks/useDebounce';
import { isUF } from '@/lib/ufIndex';
import { safeUF } from '@/lib/locationFormat';

interface CityRow {
  id: string;
  name: string;
  state: string;
  state_uf: string | null;
}

interface CityAutocompleteProps {
  value: { city: string; state: string };
  onChange: (next: { city: string; state: string }) => void;
  placeholder?: string;
  statusText?: string;
  /** Quando informado, restringe os resultados a uma UF específica. */
  stateFilter?: string;
  /** Quando informado, prioriza (sem filtrar) cidades da UF — útil com GPS. */
  preferredUF?: string;
  disabled?: boolean;
  /** Callback fired whenever the popover closes (selection, click outside, Esc). */
  onClose?: () => void;
}

/**
 * Autocomplete controlado, conectado à tabela `cities` (5.5k municípios IBGE).
 * Não permite texto livre — garante integridade dos filtros geográficos.
 */
const CityAutocomplete = ({
  value,
  onChange,
  placeholder = 'Buscar cidade...',
  statusText,
  stateFilter,
  preferredUF,
  disabled = false,
  onClose,
}: CityAutocompleteProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 200);
  const normalizedStateFilter = safeUF(stateFilter);
  const normalizedPreferredUF = safeUF(preferredUF);

  const applyStateFilter = (rows: CityRow[]) => {
    if (!normalizedStateFilter) return rows;
    return rows.filter((row) => {
      const rawUf = (row.state_uf || row.state || '').toString().trim().toUpperCase();
      const uf = isUF(rawUf) ? rawUf : '';
      return uf === normalizedStateFilter;
    });
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery('');
      onClose?.();
    }
  };

  useEffect(() => {
    let cancelled = false;
    const term = debouncedQuery.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);

    const sortByPreferred = (rows: CityRow[]) => {
      if (!normalizedPreferredUF) return rows;
      return [...rows].sort((a, b) => {
        const ua = (a.state_uf || a.state || '').toUpperCase();
        const ub = (b.state_uf || b.state || '').toUpperCase();
        const pa = ua === normalizedPreferredUF ? 0 : 1;
        const pb = ub === normalizedPreferredUF ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name, 'pt-BR');
      });
    };

    // Tenta RPC priorizada (mostra primeiro UF do GPS); fallback para search_cities → ilike.
    (async () => {
      // 1) RPC priorizada
      const prio = await supabase.rpc('search_cities_prioritized', {
        term,
        preferred_uf: normalizedPreferredUF || undefined,
      });
      if (cancelled) return;
      if (!prio.error && prio.data) {
        setResults(applyStateFilter(sortByPreferred((prio.data as CityRow[]) || [])));
        setLoading(false);
        return;
      }
      // 2) RPC clássica
      const classic = await supabase.rpc('search_cities', { term });
      if (cancelled) return;
      if (!classic.error && classic.data) {
        setResults(applyStateFilter(sortByPreferred((classic.data as CityRow[]) || [])));
        setLoading(false);
        return;
      }
      // 3) Fallback ILIKE
      const fb = await supabase
        .from('cities')
        .select('id,name,state,state_uf')
        .ilike('name', `${term}%`)
        .order('name', { ascending: true })
        .limit(20);
      if (cancelled) return;
      setResults(applyStateFilter(sortByPreferred((fb.data as CityRow[]) || [])));
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [debouncedQuery, normalizedStateFilter, normalizedPreferredUF]);

  const display = useMemo(() => {
    if (!value.city) return placeholder;
    const uf = safeUF(value.state);
    return uf ? `${value.city} • ${uf}` : value.city;
  }, [value, placeholder]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-auto min-h-11 w-full justify-between py-3 font-normal',
            !value.city && 'text-muted-foreground'
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate text-left">
            <MapPin className="h-4 w-4 shrink-0 text-accent" />
            <span className="min-w-0 truncate">{display}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[200]" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Digite o nome da cidade..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {!loading && statusText && (
              <div className="border-b border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                {statusText}
              </div>
            )}
            {!loading && normalizedStateFilter && (
              <div className="border-b border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                Exibindo apenas cidades de <span className="font-medium text-foreground">{normalizedStateFilter}</span>
              </div>
            )}
            {loading && (
              <div className="flex items-center justify-center gap-2 py-6 text-center text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando...
              </div>
            )}
            {!loading && debouncedQuery.length < 2 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Digite pelo menos 2 letras
              </div>
            )}
            {!loading && debouncedQuery.length >= 2 && results.length === 0 && (
              <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
            )}
            {results.length > 0 && (
              <CommandGroup>
                {results.map(c => {
                  const rawUf = (c.state_uf || c.state || '').toString().trim().toUpperCase();
                  const uf = isUF(rawUf) ? rawUf : '';
                  const selected = value.city === c.name && value.state === uf;
                  return (
                    <CommandItem
                      key={c.id}
                      value={`${c.name}-${uf || 'NA'}`}
                      onSelect={() => {
                        onChange({ city: c.name, state: uf });
                        handleOpenChange(false);
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex-1">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{uf}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CityAutocomplete;

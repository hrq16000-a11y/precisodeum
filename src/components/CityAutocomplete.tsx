import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, MapPin } from 'lucide-react';
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
}

/**
 * Autocomplete controlado, conectado à tabela `cities` (5.5k municípios IBGE).
 * Não permite texto livre — garante integridade dos filtros geográficos.
 */
const CityAutocomplete = ({ value, onChange, placeholder = 'Buscar cidade...' }: CityAutocompleteProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => {
    let cancelled = false;
    const term = debouncedQuery.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    supabase
      .from('cities')
      .select('id,name,state,state_uf')
      .ilike('name', `${term}%`)
      .order('name', { ascending: true })
      .limit(20)
      .then(({ data }) => {
        if (cancelled) return;
        setResults((data as CityRow[]) || []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const display = useMemo(() => {
    if (!value.city) return placeholder;
    return value.state ? `${value.city} • ${value.state}` : value.city;
  }, [value, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between font-normal',
            !value.city && 'text-muted-foreground'
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <MapPin className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate">{display}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[200]" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Digite o nome da cidade..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading && (
              <div className="py-6 text-center text-xs text-muted-foreground">Buscando...</div>
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
                  const uf = c.state_uf || c.state;
                  const selected = value.city === c.name && value.state === uf;
                  return (
                    <CommandItem
                      key={c.id}
                      value={`${c.name}-${uf}`}
                      onSelect={() => {
                        onChange({ city: c.name, state: uf });
                        setOpen(false);
                        setQuery('');
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

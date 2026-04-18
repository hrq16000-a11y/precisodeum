import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  icon?: string;
}

interface Props {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  className?: string;
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Combobox de categoria com autocomplete (digite para filtrar).
 * Substitui Selects simples em forms admin.
 */
const CategoryCombobox = ({ categories, value, onChange, placeholder = 'Buscar categoria...', className }: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = categories.find((c) => c.id === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return categories.slice(0, 50);
    const q = normalize(search);
    return categories.filter((c) => normalize(c.name).includes(q)).slice(0, 50);
  }, [search, categories]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 30);
        }}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className="flex items-center gap-2 truncate">
          {selected ? (
            <>
              <CategoryIcon icon={selected.icon || ''} size={14} />
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Digite para buscar..."
                className="w-full bg-transparent py-1.5 text-xs outline-none placeholder:text-muted-foreground"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')}>
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {value && (
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); setSearch(''); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-accent/10 border-b border-border"
              >
                <X className="h-3 w-3" /> Limpar seleção
              </button>
            )}
            {filtered.length > 0 ? (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c.id); setOpen(false); setSearch(''); }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/10 transition-colors',
                    value === c.id && 'bg-accent/10 font-medium text-accent'
                  )}
                >
                  <CategoryIcon icon={c.icon || ''} size={14} className="text-current" />
                  <span className="truncate">{c.name}</span>
                  {value === c.id && <Check className="h-3.5 w-3.5 ml-auto text-accent" />}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                Nenhuma categoria encontrada
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryCombobox;

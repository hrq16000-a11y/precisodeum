import { useState, useRef, useEffect, useMemo } from 'react';
import { X, ChevronDown, Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import CategoryIcon from '@/components/CategoryIcon';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  icon?: string;
  slug?: string;
  parent_id?: string | null;
}

interface SmartCategoryPickerProps {
  categories: Category[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  maxSelections?: number;
  placeholder?: string;
  className?: string;
}

/* ── helpers ── */

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const fuzzyMatch = (query: string, target: string): boolean => {
  const q = normalize(query);
  const t = normalize(target);
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
};

/* ── component ── */

const SmartCategoryPicker = ({
  categories,
  selectedIds,
  onToggle,
  maxSelections,
  placeholder = 'Buscar categoria...',
  className,
}: SmartCategoryPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // derive hierarchy
  const macros = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories],
  );

  const subsByParent = useMemo(() => {
    const map: Record<string, Category[]> = {};
    categories.forEach((c) => {
      if (c.parent_id) {
        (map[c.parent_id] ??= []).push(c);
      }
    });
    return map;
  }, [categories]);

  // filtered tree
  const filteredTree = useMemo(() => {
    if (!search.trim()) {
      return macros.map((m) => ({ macro: m, subs: subsByParent[m.id] || [] }));
    }
    const results: { macro: Category; subs: Category[] }[] = [];
    for (const macro of macros) {
      const subs = (subsByParent[macro.id] || []).filter((s) =>
        fuzzyMatch(search, s.name),
      );
      const macroMatches = fuzzyMatch(search, macro.name);
      if (macroMatches || subs.length > 0) {
        results.push({
          macro,
          subs: macroMatches ? subsByParent[macro.id] || [] : subs,
        });
      }
    }
    // also match orphan categories (no parent, no children)
    const orphans = categories.filter(
      (c) => !c.parent_id && !subsByParent[c.id]?.length && fuzzyMatch(search, c.name),
    );
    orphans.forEach((o) => {
      if (!results.some((r) => r.macro.id === o.id)) {
        results.push({ macro: o, subs: [] });
      }
    });
    return results;
  }, [search, macros, subsByParent, categories]);

  const selectedCats = categories.filter((c) => selectedIds.includes(c.id));

  const handleToggle = (id: string) => {
    const isSelecting = !selectedIds.includes(id);
    if (isSelecting && maxSelections && selectedIds.length >= maxSelections) {
      // Single-select mode: replace current selection instead of blocking
      if (maxSelections === 1) {
        selectedIds.forEach((sid) => onToggle(sid));
        onToggle(id);
        setOpen(false);
        setSearch('');
        return;
      }
      return;
    }
    onToggle(id);
    // Auto-close after a successful single-select pick
    if (isSelecting && maxSelections === 1) {
      setOpen(false);
      setSearch('');
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const hasResults = filteredTree.length > 0;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* trigger / chips */}
      <div
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm cursor-pointer min-h-[42px] flex flex-wrap items-center gap-1"
        onClick={handleOpen}
      >
        {selectedCats.length === 0 && !open && (
          <span className="text-muted-foreground text-xs flex items-center gap-1">
            <Search className="h-3 w-3" /> {placeholder}
          </span>
        )}
        {selectedCats.map((cat) => (
          <span
            key={cat.id}
            className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent"
          >
            <CategoryIcon icon={cat.icon || ''} size={12} className="text-accent" /> {cat.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(cat.id);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      {/* dropdown */}
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
          {/* search input */}
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')}>
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* results */}
          <div className="max-h-56 overflow-y-auto overscroll-contain">
            {hasResults ? (
              filteredTree.map(({ macro, subs }) => (
                <div key={macro.id}>
                  {subs.length > 0 ? (
                    <div className="sticky top-0 bg-muted/60 backdrop-blur-sm px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <CategoryIcon icon={macro.icon} size={12} className="text-muted-foreground" /> {macro.name}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggle(macro.id)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/10 transition-colors',
                        selectedIds.includes(macro.id) && 'bg-accent/10',
                      )}
                    >
                      <Checkbox
                        checked={selectedIds.includes(macro.id)}
                        className="pointer-events-none h-3.5 w-3.5"
                        tabIndex={-1}
                      />
                      <CategoryIcon icon={macro.icon} size={14} className="text-current" />
                      <span className={cn(selectedIds.includes(macro.id) && 'text-accent font-medium')}>
                        {macro.name}
                      </span>
                    </button>
                  )}

                  {subs.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleToggle(sub.id)}
                      className={cn(
                        'flex w-full items-center gap-2 pl-6 pr-3 py-1.5 text-sm hover:bg-accent/10 transition-colors',
                        selectedIds.includes(sub.id) && 'bg-accent/10',
                      )}
                    >
                      <Checkbox
                        checked={selectedIds.includes(sub.id)}
                        className="pointer-events-none h-3.5 w-3.5"
                        tabIndex={-1}
                      />
                      <CategoryIcon icon={sub.icon || ''} size={12} className="text-current" />
                      <span className={cn('text-sm', selectedIds.includes(sub.id) && 'text-accent font-medium')}>
                        {sub.name}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                Nenhuma categoria encontrada para "<span className="font-medium">{search}</span>"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartCategoryPicker;

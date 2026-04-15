import { useState, useMemo } from 'react';
import { icons, Search, CircleDot } from 'lucide-react';

const ALL_ICON_NAMES = Object.keys(icons).sort();

interface Props {
  value: string;
  onChange: (name: string) => void;
}

const IconPicker = ({ value, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return ALL_ICON_NAMES.slice(0, 60);
    const q = search.toLowerCase();
    return ALL_ICON_NAMES.filter(n => n.toLowerCase().includes(q)).slice(0, 60);
  }, [search]);

  const SelectedIcon = value ? (icons as Record<string, any>)[value] : null;

  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-foreground">Ícone (Lucide)</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
      >
        {SelectedIcon ? (
          <SelectedIcon size={18} strokeWidth={1.75} className="text-slate-600 shrink-0" />
        ) : (
          <CircleDot size={18} strokeWidth={1.75} className="text-muted-foreground shrink-0" />
        )}
        <span className="truncate">{value || 'Selecionar ícone'}</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 max-h-80 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                placeholder="Buscar ícone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-input bg-background pl-7 pr-3 py-1.5 text-sm text-foreground"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-56 p-2 grid grid-cols-6 gap-1">
            {filtered.map((name) => {
              const Icon = (icons as Record<string, any>)[name];
              if (!Icon) return null;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => { onChange(name); setOpen(false); setSearch(''); }}
                  className={`flex items-center justify-center p-2 rounded-lg transition-colors hover:bg-accent/10 ${
                    value === name ? 'bg-accent/20 ring-1 ring-accent' : ''
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} className="text-slate-600" />
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-6 text-center text-xs text-muted-foreground py-4">Nenhum ícone encontrado</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IconPicker;

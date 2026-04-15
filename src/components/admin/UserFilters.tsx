import { Search, Download, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PROFILE_TYPE_OPTIONS = [
  { value: 'client', label: 'Cliente' },
  { value: 'provider', label: 'Profissional' },
  { value: 'rh', label: 'Agência / RH' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
  { value: 'suspended', label: 'Suspenso' },
  { value: 'banned', label: 'Banido' },
];

const PROVIDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'rejected', label: 'Rejeitado' },
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'ranking', label: 'Melhor Ranking' },
];

interface UserFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  filterType: string;
  onFilterTypeChange: (v: string) => void;
  filterStatus: string;
  onFilterStatusChange: (v: string) => void;
  filterProviderStatus?: string;
  onFilterProviderStatusChange?: (v: string) => void;
  sortBy?: string;
  onSortChange?: (v: string) => void;
  totalResults: number;
  onExport: () => void;
}

const UserFilters = ({
  search, onSearchChange,
  filterType, onFilterTypeChange,
  filterStatus, onFilterStatusChange,
  filterProviderStatus, onFilterProviderStatusChange,
  sortBy, onSortChange,
  totalResults, onExport,
}: UserFiltersProps) => (
  <div className="space-y-3">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar usuário..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={filterStatus} onValueChange={onFilterStatusChange}>
        <SelectTrigger className="w-full sm:w-36">
          <SelectValue placeholder="Todos status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          {STATUS_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filterType} onValueChange={onFilterTypeChange}>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Todos os tipos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os tipos</SelectItem>
          {PROFILE_TYPE_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {onFilterProviderStatusChange && (
        <Select value={filterProviderStatus || 'all'} onValueChange={onFilterProviderStatusChange}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Aprovação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda aprovação</SelectItem>
            {PROVIDER_STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {onSortChange && (
        <Select value={sortBy || 'recent'} onValueChange={onSortChange}>
          <SelectTrigger className="w-full sm:w-40">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
        <Download className="h-4 w-4" /> Exportar
      </Button>
    </div>
    <p className="text-xs text-muted-foreground">{totalResults} resultado(s) encontrado(s)</p>
  </div>
);

export default UserFilters;

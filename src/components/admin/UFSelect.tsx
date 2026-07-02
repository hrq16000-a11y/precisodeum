import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const BR_UFS: { uf: string; name: string }[] = [
  { uf: 'AC', name: 'Acre' }, { uf: 'AL', name: 'Alagoas' }, { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' }, { uf: 'BA', name: 'Bahia' }, { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' }, { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' }, { uf: 'MA', name: 'Maranhão' }, { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' }, { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' }, { uf: 'PB', name: 'Paraíba' }, { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' }, { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' }, { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' }, { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' }, { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' }, { uf: 'SE', name: 'Sergipe' }, { uf: 'TO', name: 'Tocantins' },
];

interface Props {
  value: string;
  onChange: (uf: string) => void;
  placeholder?: string;
  includeAll?: boolean;
  allLabel?: string;
  className?: string;
}

/** Padronizado: usa SIGLAS oficiais (UF) de 2 letras. */
const UFSelect = ({ value, onChange, placeholder = 'UF', includeAll, allLabel = 'Todos os estados', className }: Props) => (
  <Select value={value || (includeAll ? '__all__' : '')} onValueChange={(v) => onChange(v === '__all__' ? '' : v)}>
    <SelectTrigger className={className}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent className="max-h-60">
      {includeAll && <SelectItem value="__all__">{allLabel}</SelectItem>}
      {BR_UFS.map((s) => (
        <SelectItem key={s.uf} value={s.uf}>
          <span className="font-mono font-semibold mr-2">{s.uf}</span>
          <span className="text-muted-foreground text-xs">{s.name}</span>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export default UFSelect;

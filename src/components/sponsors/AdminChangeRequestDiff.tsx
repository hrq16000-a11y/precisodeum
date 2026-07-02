import { FIELD_LABELS, type ChangeRequestRow } from '@/lib/sponsorSelfService';

interface Props {
  row: ChangeRequestRow;
}

/** Diff visual antes/depois. Snapshot é imutável, gravado na submissão. */
const AdminChangeRequestDiff = ({ row }: Props) => {
  const keys = Object.keys(row.changes || {});
  if (keys.length === 0) return <p className="text-sm text-muted-foreground">Sem alterações.</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          <th className="py-2 text-left font-medium">Campo</th>
          <th className="py-2 text-left font-medium">Antes</th>
          <th className="py-2 text-left font-medium">Depois</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => {
          const label = FIELD_LABELS[k as keyof typeof FIELD_LABELS] || k;
          const before = row.current_snapshot?.[k];
          const after = (row.changes as Record<string, unknown>)[k];
          return (
            <tr key={k} className="border-b">
              <td className="py-2 align-top font-medium">{label}</td>
              <td className="py-2 align-top text-muted-foreground break-all">{format(before)}</td>
              <td className="py-2 align-top break-all">{format(after)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

const format = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  return String(v);
};

export default AdminChangeRequestDiff;

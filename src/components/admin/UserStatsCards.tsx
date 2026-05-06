interface UserStats {
  total: number;
  active: number;
  inactive: number;
  clients: number;
  providers: number;
  rh: number;
  admins: number;
}

const UserStatsCards = ({ stats }: { stats: UserStats }) => {
  const cards = [
    { label: 'Total', value: stats.total, color: 'text-foreground' },
    { label: 'Ativos', value: stats.active, color: 'text-green-600' },
    { label: 'Inativos', value: stats.inactive, color: 'text-destructive' },
    { label: 'Clientes', value: stats.clients, color: 'text-muted-foreground' },
    { label: 'Profissionais', value: stats.providers, color: 'text-blue-500' },
    { label: 'Agências/RH', value: stats.rh, color: 'text-purple-500' },
    { label: 'Admins', value: stats.admins, color: 'text-amber-500' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
      {cards.map(s => (
        <div key={s.label} className="rounded-xl border border-border bg-card p-2.5 shadow-card text-center">
          <p className={`font-display text-lg font-bold ${s.color}`}>{s.value}</p>
          <p className="text-[10px] text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>
  );
};

export default UserStatsCards;

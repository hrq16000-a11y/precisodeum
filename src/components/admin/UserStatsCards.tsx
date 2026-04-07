import { Users, UserCheck, UserX, Briefcase, Building2, Shield, TrendingUp } from 'lucide-react';

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
  const pct = (v: number) => stats.total > 0 ? Math.round((v / stats.total) * 100) : 0;

  const cards = [
    { label: 'Total de Usuários', value: stats.total, icon: Users, accent: 'border-l-primary text-primary', pctLabel: null, trend: '+12%' },
    { label: 'Usuários Ativos', value: stats.active, icon: UserCheck, accent: 'border-l-green-500 text-green-600', pctLabel: `${pct(stats.active)}%`, trend: null },
    { label: 'Inativos', value: stats.inactive, icon: UserX, accent: 'border-l-amber-500 text-amber-600', pctLabel: `${pct(stats.inactive)}%`, trend: null },
    { label: 'Suspensos', value: 0, icon: TrendingUp, accent: 'border-l-destructive text-destructive', pctLabel: '0%', trend: null },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(s => {
        const Icon = s.icon;
        return (
          <div key={s.label} className={`rounded-xl border border-border border-l-4 ${s.accent.split(' ')[0]} bg-card p-4 shadow-card`}>
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-muted p-2">
                <Icon className={`h-5 w-5 ${s.accent.split(' ')[1]}`} />
              </div>
              {s.pctLabel && (
                <span className="text-xs font-medium text-muted-foreground">{s.pctLabel}</span>
              )}
              {s.trend && (
                <span className="text-xs font-medium text-green-600">{s.trend}</span>
              )}
            </div>
            <p className="mt-3 font-display text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        );
      })}
    </div>
  );
};

export default UserStatsCards;

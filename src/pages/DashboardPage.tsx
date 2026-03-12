import DashboardLayout from '@/components/DashboardLayout';
import { Eye, MousePointerClick, MessageSquare, Star, TrendingUp } from 'lucide-react';

const stats = [
  { label: 'Visualizações', value: '1.234', icon: Eye, change: '+12%' },
  { label: 'Cliques em contato', value: '89', icon: MousePointerClick, change: '+8%' },
  { label: 'Leads recebidos', value: '23', icon: MessageSquare, change: '+15%' },
  { label: 'Avaliação média', value: '4.8', icon: Star, change: '+0.2' },
  { label: 'Ranking na busca', value: '#3', icon: TrendingUp, change: '↑2' },
];

const DashboardPage = () => (
  <DashboardLayout>
    <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
    <p className="mt-1 text-sm text-muted-foreground">Bem-vindo de volta! Veja o resumo do seu perfil.</p>

    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <s.icon className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium text-success">{s.change}</span>
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-foreground">{s.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>

    <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-card">
      <h2 className="font-display text-lg font-bold text-foreground">Últimos Leads</h2>
      <div className="mt-4 space-y-3">
        {[
          { name: 'Maria Silva', service: 'Instalação elétrica', date: '12/03/2026', phone: '(41) 99999-1234' },
          { name: 'João Santos', service: 'Troca de disjuntor', date: '11/03/2026', phone: '(41) 98888-5678' },
          { name: 'Ana Costa', service: 'Projeto elétrico', date: '10/03/2026', phone: '(41) 97777-9012' },
        ].map((lead, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{lead.name}</p>
              <p className="text-xs text-muted-foreground">{lead.service}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{lead.date}</p>
              <p className="text-xs font-medium text-accent">{lead.phone}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </DashboardLayout>
);

export default DashboardPage;

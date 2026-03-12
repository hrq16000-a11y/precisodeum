import DashboardLayout from '@/components/DashboardLayout';
import { Users, Briefcase, MessageSquare, BarChart3, FolderOpen, Star } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const adminStats = [
  { label: 'Total Profissionais', value: '10.432', icon: Briefcase },
  { label: 'Total Usuários', value: '45.678', icon: Users },
  { label: 'Total Leads', value: '12.890', icon: MessageSquare },
  { label: 'Categorias', value: '10', icon: FolderOpen },
];

const AdminPage = () => {
  const location = useLocation();
  const isRoot = location.pathname === '/admin';

  return (
    <DashboardLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Painel Administrativo</h1>
      <p className="mt-1 text-sm text-muted-foreground">Gerencie a plataforma</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {adminStats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <s.icon className="h-5 w-5 text-accent" />
            <p className="mt-3 font-display text-2xl font-bold text-foreground">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Gerenciar Usuários', path: '/admin/usuarios', icon: Users, desc: 'Visualizar e gerenciar contas' },
          { label: 'Gerenciar Prestadores', path: '/admin/prestadores', icon: Briefcase, desc: 'Aprovar e editar perfis' },
          { label: 'Categorias', path: '/admin/categorias', icon: FolderOpen, desc: 'Adicionar e editar categorias' },
          { label: 'Avaliações', path: '/admin/avaliacoes', icon: Star, desc: 'Moderar avaliações' },
          { label: 'Estatísticas', path: '/admin/estatisticas', icon: BarChart3, desc: 'Métricas da plataforma' },
        ].map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="group rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5"
          >
            <item.icon className="h-6 w-6 text-accent" />
            <h3 className="mt-3 font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors">{item.label}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
          </Link>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default AdminPage;

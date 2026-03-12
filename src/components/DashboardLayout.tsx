import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, User, Briefcase, Star, MessageSquare, CreditCard, LogOut, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

const menuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Meu Perfil', icon: User, path: '/dashboard/perfil' },
  { label: 'Serviços', icon: Briefcase, path: '/dashboard/servicos' },
  { label: 'Avaliações', icon: Star, path: '/dashboard/avaliacoes' },
  { label: 'Leads', icon: MessageSquare, path: '/dashboard/leads' },
  { label: 'Plano', icon: CreditCard, path: '/dashboard/plano' },
];

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <Link to="/" className="font-display text-sm font-bold text-foreground">Preciso de um</Link>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-foreground">
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 transform border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} pt-14 lg:pt-0`}>
        <div className="flex h-14 items-center px-5 border-b border-sidebar-border">
          <Link to="/" className="font-display text-sm font-bold text-sidebar-foreground">Preciso de um</Link>
        </div>
        <nav className="mt-4 space-y-1 px-3">
          {menuItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-3 right-3">
          <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/50" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <main className="flex-1 pt-14 lg:ml-60 lg:pt-0">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;

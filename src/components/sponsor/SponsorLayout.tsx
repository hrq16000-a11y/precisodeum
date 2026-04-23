import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Image, BarChart3, FileText, Bell, LogOut, Menu, X, Megaphone, Settings, Shield, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { useSponsorAuth, type SponsorPermissionKey } from '@/hooks/useSponsorAuth';
import Logo from '@/components/Logo';

const sponsorMenu: { label: string; icon: any; path: string; permKey?: SponsorPermissionKey; requiresActivePlan?: boolean }[] = [
  { label: 'Visão Geral', icon: LayoutDashboard, path: '/sponsor-panel' },
  { label: 'Personalizar Página', icon: Globe, path: '/sponsor-panel/pagina', requiresActivePlan: true },
  { label: 'Meus Banners', icon: Image, path: '/sponsor-panel/banners', permKey: 'banners', requiresActivePlan: true },
  { label: 'Campanhas', icon: Megaphone, path: '/sponsor-panel/campanhas', permKey: 'campanhas', requiresActivePlan: true },
  { label: 'Métricas', icon: BarChart3, path: '/sponsor-panel/metricas', permKey: 'metricas', requiresActivePlan: true },
  { label: 'Contratos', icon: FileText, path: '/sponsor-panel/contratos', permKey: 'contratos' },
  { label: 'Notificações', icon: Bell, path: '/sponsor-panel/notificacoes', permKey: 'notificacoes' },
  { label: 'Meus Dados', icon: Settings, path: '/sponsor-panel/dados', permKey: 'dados' },
];

const SponsorLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { hasSponsorPermission, hasActivePlan, isAdmin, subscription } = useSponsorAuth(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleMenu = sponsorMenu.filter(item => {
    if (item.requiresActivePlan && !hasActivePlan && !isAdmin) return false;
    return !item.permKey || hasSponsorPermission(item.permKey);
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <div className="flex h-14 min-w-0 max-w-[calc(100%-3rem)] items-center gap-2 overflow-hidden">
          <Logo className="drop-shadow-sm" />
          <span className="sr-only">Painel patrocinador</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-foreground">
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 transform border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} pt-14 lg:pt-0`}>
        <div className="flex h-14 min-w-0 items-center gap-2 overflow-hidden px-5 border-b border-sidebar-border">
          <Logo className="drop-shadow-sm" />
          <span className="sr-only">Menu do patrocinador</span>
          <Badge variant={hasActivePlan ? 'secondary' : 'outline'} className="ml-auto text-[10px]">
            {hasActivePlan ? (subscription?.sponsor_plans?.name || 'Ativo') : 'Sem plano ativo'}
          </Badge>
        </div>
        <nav className="mt-2 space-y-0.5 px-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 56px - 80px)' }}>
          {visibleMenu.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-3 right-3 space-y-1">
          {isAdmin && (
            <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-sidebar-foreground/70" asChild>
              <Link to="/admin"><Shield className="h-4 w-4" /> Painel Admin</Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-sidebar-foreground/70" asChild>
            <Link to="/"><LayoutDashboard className="h-4 w-4" /> Ir ao Site</Link>
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/50" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="flex-1 pt-14 lg:ml-60 lg:pt-0">
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
};

export default SponsorLayout;

import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, User, Briefcase, Star, MessageSquare, CreditCard, LogOut, Menu, X, Shield, Layout, Megaphone, Users2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useSettingValue } from '@/hooks/useSiteSettings';

const DEFAULT_LOGO_URL = '/lovable-uploads/8a22c45f-f2c2-4ac8-a925-92aecd2b313b.png';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const logoUrl = useSettingValue('logo_url');
  const logo = logoUrl || DEFAULT_LOGO_URL;

  useEffect(() => {
    if (!user) return;
    supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const profileType = profile?.profile_type || 'client';
  const isClient = profileType === 'client';
  const isRH = profileType === 'rh';

  // Build menu items based on account type
  const menuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', show: true },
    { label: 'Meu Perfil', icon: User, path: '/dashboard/perfil', show: true },
    { label: 'Meus Serviços', icon: Briefcase, path: '/dashboard/servicos', show: !isClient && !isRH },
    { label: 'Minha Página', icon: Layout, path: '/dashboard/minha-pagina', show: !isClient && !isRH },
    { label: 'Minhas Vagas', icon: Megaphone, path: '/dashboard/vagas', show: !isClient },
    { label: 'Comunidade', icon: Users2, path: '/dashboard/comunidade', show: true },
    { label: 'Notificações', icon: Bell, path: '/dashboard/notificacoes', show: true },
    { label: 'Leads', icon: MessageSquare, path: '/dashboard/leads', show: !isClient && !isRH },
    { label: 'Plano', icon: CreditCard, path: '/dashboard/plano', show: !isClient && !isRH },
  ].filter(item => item.show);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <Link to="/" className="flex items-center"><img src={logo} alt="Preciso de um" className="h-7" /></Link>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-foreground">
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 flex flex-col transform border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} pt-14 lg:pt-0`}>
        <div className="flex h-14 shrink-0 items-center px-5 border-b border-sidebar-border">
          <Link to="/" className="flex items-center"><img src={logo} alt="Preciso de um" className="h-7 brightness-0 invert" /></Link>
        </div>

        {/* Account type badge */}
        <div className="mx-3 mt-3 mb-1 shrink-0 rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isClient ? '👤 Conta Cliente' : isRH ? '🏢 Conta RH' : '🔧 Conta Profissional'}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain mt-2 space-y-1 px-3 pb-4">
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
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors mt-2 border-t border-sidebar-border pt-3"
            >
              <Shield className="h-4 w-4" />
              Painel Admin
            </Link>
          )}
        </nav>
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/50" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <main className="flex-1 pt-14 lg:ml-60 lg:pt-0">
        <div className="p-4 pb-20 sm:p-6 sm:pb-6">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;

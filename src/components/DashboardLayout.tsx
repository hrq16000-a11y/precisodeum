import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, User, Briefcase, Star, MessageSquare, LogOut, Menu, X, Shield, Layout, Megaphone, Users2, Bell, Camera, LifeBuoy, AlertTriangle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardGroupNav from '@/components/dashboard/DashboardGroupNav';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { useSettingValue } from '@/hooks/useSiteSettings';
import TopLoadingBar from '@/components/ui/TopLoadingBar';

const DEFAULT_LOGO_URL = '/lovable-uploads/8a22c45f-f2c2-4ac8-a925-92aecd2b313b.png';

const sidebarItemVariants = {
  hidden: { opacity: 0, x: -12 },
  show: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.04, duration: 0.3, ease: "easeOut" as const },
  }),
};

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { hasProfilePermission } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingLeads, setPendingLeads] = useState(0);
  const [incompleteAlert, setIncompleteAlert] = useState<{ daysLeft: number } | null>(null);
  const logoUrl = useSettingValue('logo_url');
  const logo = logoUrl || DEFAULT_LOGO_URL;
  const daysLimit = Number(useSettingValue('incomplete_profile_days_limit')) || 60;

  useEffect(() => {
    if (!user) return;
    supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  // Fetch unread notifications count
  useEffect(() => {
    if (!user) return;
    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('read', false)
      .then(({ count }) => setUnreadCount(count ?? 0));
  }, [user]);

  // Fetch pending leads count
  useEffect(() => {
    if (!user || !profile) return;
    if (profile.profile_type === 'client' || profile.profile_type === 'rh') return;
    supabase.from('providers').select('id').eq('user_id', user.id).limit(1)
      .then(({ data: providers }) => {
        if (!providers?.[0]) return;
        supabase.from('leads').select('id', { count: 'exact', head: true })
          .eq('provider_id', providers[0].id).eq('status', 'new')
          .then(({ count }) => setPendingLeads(count ?? 0));
      });
  }, [user, profile]);

  // Check if profile is incomplete and show countdown alert
  useEffect(() => {
    if (!user || !profile) return;
    if (profile.profile_type === 'client') return;
    const isIncomplete = !profile.full_name?.trim() || profile.full_name?.trim() === '';
    if (!isIncomplete) { setIncompleteAlert(null); return; }
    // Check provider creation date
    supabase.from('providers').select('created_at').eq('user_id', user.id).limit(1)
      .then(({ data: providers }) => {
        if (!providers?.[0]) return;
        const createdAt = new Date(providers[0].created_at);
        const daysSince = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        const daysLeft = Math.max(0, daysLimit - daysSince);
        setIncompleteAlert({ daysLeft });
      });
  }, [user, profile, daysLimit]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const profileType = profile?.profile_type || 'client';
  const isClient = profileType === 'client';
  const isRH = profileType === 'rh';

  const menuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', show: hasProfilePermission('dashboard'), badge: 0 },
    { label: 'Meu Perfil', icon: User, path: '/dashboard/perfil', show: hasProfilePermission('profile'), badge: 0 },
    { label: 'Meus Serviços', icon: Briefcase, path: '/dashboard/servicos', show: !isClient && !isRH && hasProfilePermission('services'), badge: 0 },
    { label: 'Portfólio', icon: Camera, path: '/dashboard/portfolio', show: !isClient && !isRH && hasProfilePermission('services'), badge: 0 },
    { label: 'Minha Página', icon: Layout, path: '/dashboard/minha-pagina', show: !isClient && !isRH && hasProfilePermission('my_page'), badge: 0 },
    { label: 'Minhas Vagas', icon: Megaphone, path: '/dashboard/vagas', show: !isClient && hasProfilePermission('jobs'), badge: 0 },
    { label: 'Comunidade', icon: Users2, path: '/dashboard/comunidade', show: hasProfilePermission('community'), badge: 0 },
    { label: 'Notificações', icon: Bell, path: '/dashboard/notificacoes', show: hasProfilePermission('notifications'), badge: unreadCount },
    { label: 'Chat', icon: MessageSquare, path: '/dashboard/chat', show: !isClient, badge: 0 },
    { label: 'Leads', icon: MessageSquare, path: '/dashboard/leads', show: !isClient && !isRH && hasProfilePermission('leads'), badge: pendingLeads },
    
    { label: 'Ajuda & Suporte', icon: LifeBuoy, path: '/ajuda', show: true, badge: 0 },
  ].filter(item => item.show);

  return (
    <div className="flex min-h-screen bg-background">
      <TopLoadingBar />
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-border glass-strong px-4 lg:hidden">
        <Link to="/" className="flex items-center"><img src={logo} alt="Preciso de um" className="h-7" /></Link>
        <motion.button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-foreground p-1 rounded-lg hover:bg-muted/50 transition-colors"
          whileTap={{ scale: 0.9 }}
        >
          <AnimatePresence mode="wait">
            {sidebarOpen ? (
              <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <X className="h-5 w-5" />
              </motion.div>
            ) : (
              <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <Menu className="h-5 w-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 flex flex-col transform border-r border-sidebar-border bg-sidebar transition-transform duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} pt-14 lg:pt-0`}>
        <div className="flex h-14 shrink-0 items-center justify-between px-5 border-b border-sidebar-border">
          <Link to="/" className="flex items-center"><img src={logo} alt="Preciso de um" className="h-7 brightness-0 invert" /></Link>
          <Link to="/" className="text-[9px] text-sidebar-foreground/30 hover:text-sidebar-foreground/50 transition-colors font-medium">← Site</Link>
        </div>

        {/* User info card */}
        <motion.div
          className="mx-3 mt-3 mb-1 shrink-0 rounded-xl bg-sidebar-accent/30 p-3 relative overflow-hidden"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2.5">
            {profile?.avatar_url ? (
              <div className="relative shrink-0">
                <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-xl object-cover border border-sidebar-border/50" />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-sidebar" />
                </span>
              </div>
            ) : (
              <div className="h-9 w-9 rounded-xl bg-accent/20 flex items-center justify-center text-accent text-sm font-bold shrink-0">
                {(profile?.full_name || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{profile?.full_name || 'Usuário'}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">
                {isClient ? 'Cliente' : isRH ? 'RH' : 'Profissional'}
              </p>
            </div>
          </div>
          {/* Mini progress bar for profile completeness (providers only) */}
          {!isClient && !isRH && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-sidebar-foreground/40">Perfil</span>
                {unreadCount > 0 && (
                  <span className="text-[9px] font-bold text-accent">{unreadCount} nova{unreadCount !== 1 ? 's' : ''}</span>
                )}
              </div>
              <div className="h-1 rounded-full bg-sidebar-border/50 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: '60%' }}
                  transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}
        </motion.div>

        <nav className="flex-1 overflow-y-auto overscroll-contain mt-2 space-y-0.5 px-3 pb-4">
          {menuItems.map((item, i) => {
            const active = location.pathname === item.path;
            return (
              <motion.div
                key={item.path}
                custom={i}
                variants={sidebarItemVariants}
                initial="hidden"
                animate="show"
              >
                <Link
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 relative ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}`}
                >
                  {active && (
                    <motion.div
                      layoutId="sidebar-active-pill"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <motion.div
                    animate={active ? { scale: 1.15, rotate: [0, -5, 5, 0] } : { scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <item.icon className={`h-4 w-4 ${active ? 'text-accent' : 'group-hover:text-sidebar-foreground'}`} />
                  </motion.div>
                  <span className="flex-1">{item.label}</span>
                  {item.badge > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[9px] font-bold text-accent-foreground shadow-sm"
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </motion.span>
                  )}
                </Link>
              </motion.div>
            );
          })}
          {isAdmin && (
            <motion.div
              custom={menuItems.length}
              variants={sidebarItemVariants}
              initial="hidden"
              animate="show"
            >
              <Link
                to="/admin"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-all duration-200 mt-2 border-t border-sidebar-border pt-3"
              >
                <Shield className="h-4 w-4" />
                Painel Admin
              </Link>
            </motion.div>
          )}
        </nav>
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/50 transition-transform active:scale-95" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {/* Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 z-30 bg-foreground/20 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 pt-14 lg:ml-60 lg:pt-0">
        {/* Profile status strip for providers with incomplete profiles */}
        {!isClient && !isRH && profile && (() => {
          const items = [
            !!profile?.full_name?.trim(),
            !!profile?.phone?.trim(),
            !!profile?.avatar_url,
          ];
          const pct = Math.round((items.filter(Boolean).length / items.length) * 100);
          if (pct >= 100) return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-4 py-2 border-b border-accent/20 bg-accent/5"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-accent">{pct}% completo</span>
                  <div className="flex-1 h-1.5 rounded-full bg-border/50 overflow-hidden max-w-[120px]">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.3, duration: 0.6 }}
                    />
                  </div>
                </div>
              </div>
              <Link to="/dashboard/perfil" className="text-[10px] font-medium text-accent flex items-center gap-0.5 hover:underline shrink-0">
                Completar <ChevronRight className="h-3 w-3" />
              </Link>
            </motion.div>
          );
        })()}
        <AnimatePresence mode="wait">
          <motion.div
            className="p-4 pb-20 sm:p-6 sm:pb-6"
            initial={{ opacity: 0, y: 16, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
            key={location.pathname}
          >
            <DashboardGroupNav />
            {incompleteAlert && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4"
              >
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-destructive">Complete seu cadastro!</p>
                  <p className="text-xs text-muted-foreground">
                    {incompleteAlert.daysLeft > 0
                      ? `Você tem ${incompleteAlert.daysLeft} dias para preencher seus dados básicos (nome, cidade) antes que seu perfil seja removido.`
                      : 'Seu prazo expirou. Complete seus dados imediatamente para evitar a remoção do perfil.'}
                  </p>
                </div>
                <Button variant="accent" size="sm" asChild>
                  <Link to="/dashboard/perfil">Completar</Link>
                </Button>
              </motion.div>
            )}
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default DashboardLayout;

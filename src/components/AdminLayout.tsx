import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Briefcase, FolderOpen, BarChart3, MapPin, LogOut, Menu, X, Shield, Megaphone, Globe, HelpCircle, Wrench, Sparkles, ClipboardList, Users2, Newspaper, HandshakeIcon, LayoutGrid, ScrollText, Trash2, Database, Image as ImageIcon, Smartphone, Crown, FileImage, FileText, Package, Blocks, PanelTop, Footprints, MessageSquareQuote, MousePointerClick, LayoutList, Target, CreditCard, Search as SearchIcon, ChevronDown } from 'lucide-react';
import AdminGroupNav, { AdminGroupTabs } from '@/components/admin/AdminGroupNav';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { usePermissions, ADMIN_ROUTE_PERMISSIONS, type UserPermissions } from '@/hooks/usePermissions';
import TopLoadingBar from '@/components/ui/TopLoadingBar';

const menuGroups = [
  {
    label: 'Geral',
    items: [
      { label: 'Visão Geral', icon: LayoutDashboard, path: '/admin' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { label: 'Prestadores', icon: Briefcase, path: '/admin/prestadores' },
      { label: 'Usuários', icon: Users, path: '/admin/usuarios' },
      { label: 'Níveis', icon: Shield, path: '/admin/niveis' },
      { label: 'Tipos de Conta', icon: CreditCard, path: '/admin/tipos-conta' },
      { label: 'CRM Usuários', icon: Target, path: '/admin/crm-usuarios' },
      { label: 'Serviços', icon: Package, path: '/admin/servicos' },
      { label: 'Leads', icon: FileText, path: '/admin/leads' },
      { label: 'Planos & Regras', icon: Crown, path: '/admin/regras' },
      { label: 'Comunidade', icon: Users2, path: '/admin/comunidade' },
    ],
  },
  {
    label: 'Conteúdo',
    items: [
      { label: 'Hero / Banners', icon: ImageIcon, path: '/admin/hero-banners' },
      { label: 'Blocos de Página', icon: PanelTop, path: '/admin/blocos' },
      { label: 'Páginas', icon: FileText, path: '/admin/paginas' },
      { label: 'Categorias', icon: FolderOpen, path: '/admin/categorias' },
      { label: 'Vagas', icon: ClipboardList, path: '/admin/vagas' },
      { label: 'Blog / Notícias', icon: Newspaper, path: '/admin/blog' },
      { label: 'Serv. Populares', icon: Wrench, path: '/admin/servicos-populares' },
      { label: 'FAQ', icon: HelpCircle, path: '/admin/faq' },
      { label: 'Destaques', icon: Sparkles, path: '/admin/destaques' },
      { label: 'Como Funciona', icon: Footprints, path: '/admin/como-funciona' },
      { label: 'Depoimentos', icon: MessageSquareQuote, path: '/admin/depoimentos' },
      { label: 'Blocos CTA', icon: MousePointerClick, path: '/admin/cta-blocos' },
      { label: 'Ordem Seções', icon: LayoutList, path: '/admin/secoes-home' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { label: 'Patrocinadores', icon: Megaphone, path: '/admin/patrocinadores' },
      { label: 'CRM Comercial', icon: HandshakeIcon, path: '/admin/crm-patrocinadores' },
      { label: 'Slots de Anúncios', icon: LayoutGrid, path: '/admin/slots-anuncios' },
      { label: 'Painel Sponsor', icon: Shield, path: '/sponsor-panel' },
      { label: 'Cidades', icon: MapPin, path: '/admin/cidades' },
      { label: 'Estatísticas', icon: BarChart3, path: '/admin/estatisticas' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Meta Tags & SEO', icon: Globe, path: '/admin/metatags' },
      { label: 'Menus', icon: Menu, path: '/admin/menus' },
      { label: 'Configurações', icon: Shield, path: '/admin/configuracoes' },
      { label: 'Trilha de Auditoria', icon: ScrollText, path: '/admin/auditoria' },
      { label: 'Auditoria Ref', icon: Shield, path: '/admin/auditoria-ref' },
      { label: 'Mídia & Arquivos', icon: FileImage, path: '/admin/midia' },
      { label: 'Instalar App (PWA)', icon: Smartphone, path: '/admin/pwa' },
      { label: 'Módulos', icon: Blocks, path: '/admin/modulos' },
      { label: 'Backup & Export', icon: Database, path: '/admin/backup' },
      { label: 'Lixeira', icon: Trash2, path: '/admin/lixeira' },
    ],
  },
];

const AdminMobileStats = () => {
  const [stats, setStats] = useState({ users: 0, providers: 0, leads: 0 });
  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('providers').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    ]).then(([u, p, l]) => setStats({ users: u.count ?? 0, providers: p.count ?? 0, leads: l.count ?? 0 }));
  }, []);
  return (
    <div className="flex items-center gap-1.5 ml-2">
      {[
        { label: 'U', value: stats.users, color: 'bg-blue-500/15 text-blue-600' },
        { label: 'P', value: stats.providers, color: 'bg-amber-500/15 text-amber-600' },
        { label: 'L', value: stats.leads, color: 'bg-emerald-500/15 text-emerald-600' },
      ].map(s => (
        <span key={s.label} className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${s.color}`}>
          {s.label}{s.value > 99 ? '99+' : s.value}
        </span>
      ))}
    </div>
  );
};

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { hasPermission } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const filteredGroups = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    return menuGroups.map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (!isAdmin) {
          const requiredPerm = ADMIN_ROUTE_PERMISSIONS[item.path];
          if (requiredPerm && !hasPermission(requiredPerm)) return false;
        }
        if (q && !item.label.toLowerCase().includes(q)) return false;
        return true;
      }),
    })).filter(group => group.items.length > 0);
  }, [isAdmin, hasPermission, sidebarSearch]);

  // Keyboard shortcut: Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('[data-admin-search]');
        input?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-background">
      <TopLoadingBar />
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-border glass-strong px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-destructive" />
          <span className="font-display text-sm font-bold text-foreground">Admin</span>
          <AdminMobileStats />
        </div>
        <motion.button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-foreground p-1 rounded-lg hover:bg-muted/50"
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

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col transform border-r border-sidebar-border bg-sidebar transition-transform duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} pt-14 lg:pt-0`}>
        <div className="flex h-14 shrink-0 items-center gap-2 px-5 border-b border-sidebar-border">
          <motion.div
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Shield className="h-3.5 w-3.5 text-destructive" />
          </motion.div>
          <span className="font-display text-sm font-bold text-sidebar-foreground">Admin Panel</span>
        </div>
        {/* Sidebar Search */}
        <div className="px-3 pt-2.5 pb-1.5">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-foreground/40" />
            <input
              type="text"
              data-admin-search
              placeholder="Buscar menu..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full rounded-xl border border-sidebar-border bg-sidebar-accent/30 pl-8 pr-12 py-2 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:ring-1 focus:ring-accent/50 transition-colors"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded-md border border-sidebar-border/50 bg-sidebar-accent/20 px-1.5 py-0.5 text-[9px] text-sidebar-foreground/30 font-mono">
              ⌘K
            </kbd>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto overscroll-contain mt-1 space-y-1 px-3 pb-4">
          {filteredGroups.map((group) => {
            const isCollapsed = !!collapsedGroups[group.label] && !sidebarSearch;
            const hasActiveItem = group.items.some(item => item.path === location.pathname);
            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center justify-between mb-0.5 px-3 py-1.5 rounded-lg hover:bg-sidebar-accent/30 transition-colors group"
                >
                  <span className={`text-[10px] font-semibold uppercase tracking-wider transition-colors ${hasActiveItem ? 'text-accent' : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60'}`}>
                    {group.label}
                  </span>
                  <motion.div
                    animate={{ rotate: isCollapsed ? -90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="h-3 w-3 text-sidebar-foreground/30" />
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5 pb-2">
                        {group.items.map((item) => {
                          const active = location.pathname === item.path;
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              onClick={() => setSidebarOpen(false)}
                              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 relative ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:translate-x-0.5'}`}
                            >
                              {active && (
                                <motion.div
                                  layoutId="admin-sidebar-active"
                                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-accent"
                                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                />
                              )}
                              <item.icon className={`h-4 w-4 shrink-0 transition-transform duration-200 ${active ? 'scale-110' : ''}`} />
                              <span className="truncate">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-sidebar-border p-3 space-y-1">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-sidebar-foreground/70 transition-transform active:scale-95" asChild>
            <Link to="/dashboard"><LayoutDashboard className="h-4 w-4" /> Ir ao Dashboard</Link>
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/50 transition-transform active:scale-95" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

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

      <main className="flex-1 min-w-0 overflow-x-hidden pt-14 lg:ml-64 lg:pt-0 flex flex-col">
        <AdminGroupTabs />
        <motion.div
          className="flex-1 p-3 sm:p-6 max-w-full"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
          key={location.pathname}
        >
          {/* Auto Breadcrumb */}
          {(() => {
            const current = menuGroups.flatMap(g => g.items).find(i => i.path === location.pathname);
            const group = menuGroups.find(g => g.items.some(i => i.path === location.pathname));
            if (!current || !group) return null;
            return (
              <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Link to="/admin" className="hover:text-foreground transition-colors">Admin</Link>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-muted-foreground/60">{group.label}</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="font-medium text-foreground">{current.label}</span>
              </nav>
            );
          })()}
          <AdminGroupNav />
          {children}
        </motion.div>
      </main>
    </div>
  );
};

export default AdminLayout;

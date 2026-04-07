import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Briefcase, FolderOpen, BarChart3, MapPin, LogOut, Menu, X, Shield, Megaphone, Globe, HelpCircle, Wrench, Sparkles, ClipboardList, Users2, Newspaper, HandshakeIcon, LayoutGrid, ScrollText, Trash2, Database, Image as ImageIcon, Smartphone, Crown, FileImage, FileText, Package, Blocks, PanelTop, Footprints, MessageSquareQuote, MousePointerClick, LayoutList, Target, CreditCard } from 'lucide-react';
import AdminGroupNav from '@/components/admin/AdminGroupNav';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { usePermissions, ADMIN_ROUTE_PERMISSIONS, type UserPermissions } from '@/hooks/usePermissions';

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
      { label: 'Planos & Regras', icon: Crown, path: '/admin/planos-regras' },
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
      { label: 'Mídia & Arquivos', icon: FileImage, path: '/admin/midia' },
      { label: 'Instalar App (PWA)', icon: Smartphone, path: '/admin/pwa' },
      { label: 'Módulos', icon: Blocks, path: '/admin/modulos' },
      { label: 'Backup & Export', icon: Database, path: '/admin/backup' },
      { label: 'Lixeira', icon: Trash2, path: '/admin/lixeira' },
    ],
  },
];

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { hasPermission } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (isAdmin) return true;
      const requiredPerm = ADMIN_ROUTE_PERMISSIONS[item.path];
      if (!requiredPerm) return true;
      return hasPermission(requiredPerm);
    }),
  })).filter(group => group.items.length > 0);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-border glass-strong px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-destructive" />
          <span className="font-display text-sm font-bold text-foreground">Admin</span>
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

      <aside className={`fixed inset-y-0 left-0 z-40 w-60 flex flex-col transform border-r border-sidebar-border bg-sidebar transition-transform duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} pt-14 lg:pt-0`}>
        <div className="flex h-14 shrink-0 items-center gap-2 px-5 border-b border-sidebar-border">
          <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
            <Shield className="h-4 w-4 text-destructive" />
          </motion.div>
          <span className="font-display text-sm font-bold text-sidebar-foreground">Admin Panel</span>
        </div>
        <nav className="flex-1 overflow-y-auto overscroll-contain mt-2 space-y-4 px-3 pb-4">
          {filteredGroups.map((group, gi) => (
            <div key={group.label}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item, ii) => {
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
            </div>
          ))}
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

      <main className="flex-1 min-w-0 overflow-x-hidden pt-14 lg:ml-60 lg:pt-0">
        <motion.div
          className="p-3 sm:p-6 max-w-full"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          key={location.pathname}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
};

export default AdminLayout;

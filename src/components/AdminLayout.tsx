import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Briefcase, FolderOpen, BarChart3, MapPin, LogOut, Menu, X, Shield, Megaphone, Globe, HelpCircle, Wrench, Sparkles, ClipboardList, Users2, Newspaper, HandshakeIcon, LayoutGrid, ScrollText, Trash2, Database, Image as ImageIcon, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

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
      { label: 'Comunidade', icon: Users2, path: '/admin/comunidade' },
    ],
  },
  {
    label: 'Conteúdo',
    items: [
      { label: 'Hero / Banners', icon: ImageIcon, path: '/admin/hero-banners' },
      { label: 'Categorias', icon: FolderOpen, path: '/admin/categorias' },
      { label: 'Vagas', icon: ClipboardList, path: '/admin/vagas' },
      { label: 'Blog / Notícias', icon: Newspaper, path: '/admin/blog' },
      { label: 'Serv. Populares', icon: Wrench, path: '/admin/servicos-populares' },
      { label: 'FAQ', icon: HelpCircle, path: '/admin/faq' },
      { label: 'Destaques', icon: Sparkles, path: '/admin/destaques' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { label: 'Patrocinadores', icon: Megaphone, path: '/admin/patrocinadores' },
      { label: 'CRM Comercial', icon: HandshakeIcon, path: '/admin/crm-patrocinadores' },
      { label: 'Slots de Anúncios', icon: LayoutGrid, path: '/admin/slots-anuncios' },
      { label: 'Cidades', icon: MapPin, path: '/admin/cidades' },
      { label: 'Estatísticas', icon: BarChart3, path: '/admin/estatisticas' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Meta Tags & SEO', icon: Globe, path: '/admin/metatags' },
      { label: 'Configurações', icon: Shield, path: '/admin/configuracoes' },
      { label: 'Trilha de Auditoria', icon: ScrollText, path: '/admin/auditoria' },
      { label: 'Instalar App (PWA)', icon: Smartphone, path: '/admin/pwa' },
      { label: 'Backup & Export', icon: Database, path: '/admin/backup' },
      { label: 'Lixeira', icon: Trash2, path: '/admin/lixeira' },
    ],
  },
];

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
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
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-destructive" />
          <span className="font-display text-sm font-bold text-foreground">Admin</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-foreground">
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <aside className={`fixed inset-y-0 left-0 z-40 w-60 flex flex-col transform border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} pt-14 lg:pt-0`}>
        <div className="flex h-14 shrink-0 items-center gap-2 px-5 border-b border-sidebar-border">
          <Shield className="h-4 w-4 text-destructive" />
          <span className="font-display text-sm font-bold text-sidebar-foreground">Admin Panel</span>
        </div>
        <nav className="flex-1 overflow-y-auto overscroll-contain mt-2 space-y-4 px-3 pb-4">
          {menuGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
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
              </div>
            </div>
          ))}
        </nav>
        <div className="shrink-0 border-t border-sidebar-border p-3 space-y-1">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-sidebar-foreground/70" asChild>
            <Link to="/dashboard"><LayoutDashboard className="h-4 w-4" /> Ir ao Dashboard</Link>
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

export default AdminLayout;

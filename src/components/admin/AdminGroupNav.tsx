import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import {
  LayoutDashboard, Users, Briefcase, FolderOpen, BarChart3, MapPin, Megaphone, Globe, HelpCircle, Wrench, Sparkles,
  ClipboardList, Users2, Newspaper, HandshakeIcon, LayoutGrid, ScrollText, Trash2, Database, Smartphone, Crown,
  FileImage, FileText, Package, Blocks, PanelTop, Footprints, MessageSquareQuote, MousePointerClick, LayoutList,
  Target, CreditCard, Shield, Menu as MenuIcon, ImageIcon,
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard, Briefcase, Users, Shield, CreditCard, Target, Package, FileText, Crown, Users2,
  ImageIcon, PanelTop, FolderOpen, ClipboardList, Newspaper, Wrench, HelpCircle, Sparkles, Footprints,
  MessageSquareQuote, MousePointerClick, LayoutList, Megaphone, HandshakeIcon, LayoutGrid, MapPin, BarChart3,
  Globe, MenuIcon, ScrollText, FileImage, Smartphone, Blocks, Database, Trash2,
};

interface GroupItem {
  label: string;
  icon: string;
  path: string;
}

const menuGroups: { label: string; items: GroupItem[] }[] = [
  {
    label: 'Geral',
    items: [
      { label: 'Visão Geral', icon: 'LayoutDashboard', path: '/admin' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { label: 'Prestadores', icon: 'Briefcase', path: '/admin/prestadores' },
      { label: 'Usuários', icon: 'Users', path: '/admin/usuarios' },
      { label: 'Níveis', icon: 'Shield', path: '/admin/niveis' },
      { label: 'Tipos de Conta', icon: 'CreditCard', path: '/admin/tipos-conta' },
      { label: 'CRM Usuários', icon: 'Target', path: '/admin/crm-usuarios' },
      { label: 'Serviços', icon: 'Package', path: '/admin/servicos' },
      { label: 'Leads', icon: 'FileText', path: '/admin/leads' },
      { label: 'Planos & Regras', icon: 'Crown', path: '/admin/planos-regras' },
      { label: 'Comunidade', icon: 'Users2', path: '/admin/comunidade' },
    ],
  },
  {
    label: 'Conteúdo',
    items: [
      { label: 'Hero / Banners', icon: 'ImageIcon', path: '/admin/hero-banners' },
      { label: 'Blocos', icon: 'PanelTop', path: '/admin/blocos' },
      { label: 'Páginas', icon: 'FileText', path: '/admin/paginas' },
      { label: 'Categorias', icon: 'FolderOpen', path: '/admin/categorias' },
      { label: 'Vagas', icon: 'ClipboardList', path: '/admin/vagas' },
      { label: 'Blog', icon: 'Newspaper', path: '/admin/blog' },
      { label: 'Serv. Populares', icon: 'Wrench', path: '/admin/servicos-populares' },
      { label: 'FAQ', icon: 'HelpCircle', path: '/admin/faq' },
      { label: 'Destaques', icon: 'Sparkles', path: '/admin/destaques' },
      { label: 'Como Funciona', icon: 'Footprints', path: '/admin/como-funciona' },
      { label: 'Depoimentos', icon: 'MessageSquareQuote', path: '/admin/depoimentos' },
      { label: 'CTA', icon: 'MousePointerClick', path: '/admin/cta-blocos' },
      { label: 'Ordem Seções', icon: 'LayoutList', path: '/admin/secoes-home' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { label: 'Patrocinadores', icon: 'Megaphone', path: '/admin/patrocinadores' },
      { label: 'CRM Comercial', icon: 'HandshakeIcon', path: '/admin/crm-patrocinadores' },
      { label: 'Slots Anúncios', icon: 'LayoutGrid', path: '/admin/slots-anuncios' },
      { label: 'Cidades', icon: 'MapPin', path: '/admin/cidades' },
      { label: 'Estatísticas', icon: 'BarChart3', path: '/admin/estatisticas' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'SEO', icon: 'Globe', path: '/admin/metatags' },
      { label: 'Menus', icon: 'MenuIcon', path: '/admin/menus' },
      { label: 'Config.', icon: 'Shield', path: '/admin/configuracoes' },
      { label: 'Auditoria', icon: 'ScrollText', path: '/admin/auditoria' },
      { label: 'Mídia', icon: 'FileImage', path: '/admin/midia' },
      { label: 'PWA', icon: 'Smartphone', path: '/admin/pwa' },
      { label: 'Módulos', icon: 'Blocks', path: '/admin/modulos' },
      { label: 'Backup', icon: 'Database', path: '/admin/backup' },
      { label: 'Lixeira', icon: 'Trash2', path: '/admin/lixeira' },
    ],
  },
];

function findCurrentGroup(pathname: string) {
  for (const group of menuGroups) {
    const match = group.items.find(item => item.path === pathname);
    if (match) return group;
  }
  return null;
}

/** Top-level group tabs — always visible, allows jumping between groups */
export const AdminGroupTabs = () => {
  const location = useLocation();
  const currentGroup = findCurrentGroup(location.pathname);

  return (
    <div className="border-b border-border bg-muted/30">
      <ScrollArea className="w-full">
        <div className="flex gap-0.5 px-2 py-1">
          {menuGroups.map((group) => {
            const active = currentGroup?.label === group.label;
            const firstPath = group.items[0].path;
            return (
              <Link
                key={group.label}
                to={firstPath}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all duration-200 shrink-0 ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {group.label}
              </Link>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-0.5" />
      </ScrollArea>
    </div>
  );
};

/** Sub-navigation within the current group */
const AdminGroupNav = () => {
  const location = useLocation();
  const currentGroup = findCurrentGroup(location.pathname);

  if (!currentGroup || currentGroup.items.length <= 1) return null;

  return (
    <div className="mb-4 -mx-1">
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {currentGroup.label}
        </span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
        <span className="text-[10px] font-semibold text-foreground/80">
          {currentGroup.items.find(i => i.path === location.pathname)?.label}
        </span>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-1 pb-1 px-1">
          {currentGroup.items.map((item) => {
            const active = location.pathname === item.path;
            const Icon = iconMap[item.icon] || LayoutDashboard;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200 shrink-0 ${
                  active
                    ? 'bg-accent/15 text-accent border border-accent/30'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-1" />
      </ScrollArea>
    </div>
  );
};

export default AdminGroupNav;

import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import {
  LayoutDashboard, User, Briefcase, Star, MessageSquare, CreditCard, Layout, Megaphone, Users2, Bell, Gift,
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const DashboardGroupNav = () => {
  const location = useLocation();
  const { profile } = useAuth();
  const profileType = profile?.profile_type || 'client';
  const isClient = profileType === 'client';
  const isRH = profileType === 'rh';

  const groups: NavGroup[] = [
    {
      label: 'Geral',
      items: [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      ],
    },
    {
      label: 'Conta',
      items: [
        { label: 'Meu Perfil', icon: User, path: '/dashboard/perfil' },
        { label: 'Notificações', icon: Bell, path: '/dashboard/notificacoes' },
        { label: 'Comunidade', icon: Users2, path: '/dashboard/comunidade' },
      ],
    },
    ...(!isClient && !isRH ? [{
      label: 'Profissional',
      items: [
        { label: 'Meus Serviços', icon: Briefcase, path: '/dashboard/servicos' },
        { label: 'Minha Página', icon: Layout, path: '/dashboard/minha-pagina' },
        { label: 'Leads', icon: MessageSquare, path: '/dashboard/leads' },
        { label: 'Indicações', icon: Gift, path: '/dashboard/indicacoes' },
        { label: 'Plano', icon: CreditCard, path: '/dashboard/plano' },
      ],
    }] : []),
    ...(!isClient ? [{
      label: 'Vagas',
      items: [
        { label: 'Minhas Vagas', icon: Megaphone, path: '/dashboard/vagas' },
      ],
    }] : []),
  ];

  const currentGroup = groups.find(g => g.items.some(i => i.path === location.pathname));
  if (!currentGroup || currentGroup.items.length <= 1) return null;

  return (
    <div className="mb-5 -mx-1">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-2.5 px-1">
        <Link to="/dashboard" className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          <Home className="h-3 w-3" />
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {currentGroup.label}
        </span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
        <span className="text-[10px] font-semibold text-foreground/80">
          {currentGroup.items.find(i => i.path === location.pathname)?.label}
        </span>
      </div>

      {/* Enhanced tab bar */}
      <ScrollArea className="w-full">
        <div className="flex gap-1 pb-1 px-1">
          {currentGroup.items.map((item) => {
            const active = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all duration-200 shrink-0 ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="dashboard-tab-active"
                    className="absolute inset-0 rounded-xl bg-primary -z-10"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? '' : ''}`} />
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

export default DashboardGroupNav;

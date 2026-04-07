import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import {
  LayoutDashboard, User, Briefcase, Star, MessageSquare, CreditCard, Layout, Megaphone, Users2, Bell,
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';

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

  // Find the group the current page belongs to
  const currentGroup = groups.find(g => g.items.some(i => i.path === location.pathname));

  // Don't show for pages with only 1 item in the group
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
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 shrink-0 ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
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

export default DashboardGroupNav;

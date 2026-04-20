import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, LayoutGrid, User, Plus, Bell, Heart, Star, Settings, MessageCircle, Briefcase, MapPin, Grid, Menu, Bookmark, ShoppingBag, Zap, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { motion, AnimatePresence } from 'framer-motion';
import { useBottomNav, type BottomNavItem, type BottomNavConfig } from '@/hooks/useBottomNav';

const ICON_MAP: Record<string, LucideIcon> = {
  Home, Search, LayoutGrid, User, Plus, Bell, Heart, Star, Settings,
  MessageCircle, Briefcase, MapPin, Grid, Menu, Bookmark, ShoppingBag, Zap,
};
const getIcon = (name: string): React.ElementType => ICON_MAP[name] || Home;

// ── FAB button (central "Criar") ──
const FabButton = ({ onClick, icon: Icon, label }: { onClick: () => void; icon: React.ElementType; label: string }) => (
  <motion.button
    onClick={onClick}
    className="relative flex flex-col items-center justify-center w-12 py-0.5"
    whileTap={{ scale: 0.85 }}
  >
    <motion.div
      className="relative -mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent/80 shadow-md shadow-accent/25"
      whileHover={{ scale: 1.1 }}
      animate={{ boxShadow: ['0 3px 10px 0 hsl(var(--accent)/0.25)', '0 3px 16px 0 hsl(var(--accent)/0.4)', '0 3px 10px 0 hsl(var(--accent)/0.25)'] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Icon className="h-4 w-4 text-accent-foreground" />
    </motion.div>
    <span className="mt-0 text-[8px] font-semibold text-accent leading-tight">{label}</span>
  </motion.button>
);

// ── Regular nav item ──
const NavItem = ({ icon: Icon, label, isActive, onClick, badge }: { icon: React.ElementType; label: string; isActive: boolean; onClick: () => void; badge?: number }) => (
  <motion.button
    onClick={onClick}
    className="relative flex flex-col items-center justify-center w-12 py-0.5 transition-colors text-muted-foreground"
    whileTap={{ scale: 0.85 }}
  >
    <AnimatePresence>
      {isActive && (
        <motion.div layoutId="mobile-nav-bg" className="absolute top-0 h-7 w-7 rounded-lg bg-accent/10" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }} />
      )}
    </AnimatePresence>
    {isActive && (
      <motion.div layoutId="mobile-nav-indicator" className="absolute -top-1 h-0.5 w-6 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
    )}
    <motion.div className="relative z-10 flex h-6 w-6 items-center justify-center" animate={isActive ? { scale: 1.05 } : { scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
      <Icon className={`h-4 w-4 transition-colors duration-200 ${isActive ? 'text-accent' : ''}`} />
      {badge && badge > 0 && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-0.5 -right-1 flex h-3 min-w-[12px] items-center justify-center rounded-full bg-destructive px-0.5 text-[7px] font-bold text-destructive-foreground">
          {badge > 9 ? '9+' : badge}
        </motion.span>
      )}
    </motion.div>
    <AnimatePresence>
      {isActive ? (
        <motion.span initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 2 }} className="text-[8px] font-bold text-accent leading-tight">{label}</motion.span>
      ) : (
        <span className="text-[8px] font-medium leading-tight">{label}</span>
      )}
    </AnimatePresence>
  </motion.button>
);

// ── Fallback (hardcoded) ──
const FallbackNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  const hiddenPaths = ['/admin', '/login', '/cadastro', '/reset-password', '/sponsor-panel'];
  const shouldHide = hiddenPaths.some(p => location.pathname.startsWith(p));
  if (shouldHide) return null;

  const handleCriar = () => navigate(user ? '/dashboard/servicos' : '/login');

  return (
    <>
      <div className="h-12 md:hidden" />
      <nav
        className="fixed bottom-0 left-0 right-0 border-t border-border/40 bg-card/90 backdrop-blur-xl supports-[backdrop-filter]:bg-card/80 md:hidden"
        style={{ zIndex: 1000, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around gap-1 px-2 py-1">
          <NavItem icon={Home} label="Início" isActive={location.pathname === '/' || location.pathname === '/index'} onClick={() => navigate('/')} />
          <NavItem icon={Search} label="Buscar" isActive={location.pathname === '/buscar'} onClick={() => navigate('/buscar')} />
          <FabButton icon={Plus} label="Criar" onClick={handleCriar} />
          <NavItem icon={MessageCircle} label="Chat" isActive={location.pathname.startsWith('/dashboard/chat')} onClick={() => navigate(user ? '/dashboard/chat' : '/login')} />
          <NavItem icon={User} label="Perfil" isActive={location.pathname.startsWith('/dashboard') && !location.pathname.startsWith('/dashboard/chat')} onClick={() => navigate(user ? '/dashboard' : '/login')} badge={unreadCount} />
        </div>
      </nav>
    </>
  );
};

// ── Dynamic nav item ──
const DynamicNavItem = ({ item, isActive, navigate, user }: { item: BottomNavItem; isActive: boolean; navigate: (path: string) => void; user: any }) => {
  const Icon = getIcon(item.icon);

  const handleClick = () => {
    if (item.requires_auth && !user) { navigate('/login'); return; }
    if (item.action_type === 'external') { window.open(item.external_url || item.route_path, '_blank'); return; }
    navigate(item.route_path);
  };

  // FAB style for "large" items
  if (item.size === 'large') {
    return <FabButton icon={Icon} label={item.label} onClick={handleClick} />;
  }

  return (
    <NavItem
      icon={Icon}
      label={item.label}
      isActive={isActive}
      onClick={handleClick}
      badge={item.badge ? parseInt(item.badge) || 0 : 0}
    />
  );
};

// ── Dynamic nav bar ──
const DynamicNav = ({ config, items }: { config: BottomNavConfig; items: BottomNavItem[] }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  const hiddenPaths = config.hidden_paths || [];
  const shouldHide = hiddenPaths.some((p: string) => location.pathname.startsWith(p));
  if (shouldHide) return null;

  const navStyle: React.CSSProperties = {
    zIndex: 1000,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    ...(config.background_color ? { backgroundColor: config.background_color } : {}),
    ...(config.border_color ? { borderColor: config.border_color } : {}),
  };

  const navClasses = [
    'fixed bottom-0 left-0 right-0 border-t',
    config.mobile_only ? 'md:hidden' : '',
    !config.background_color ? 'bg-card/90' : '',
    !config.border_color ? 'border-border/40' : '',
    config.blur ? 'backdrop-blur-xl supports-[backdrop-filter]:bg-card/80' : '',
    config.shadow ? 'shadow-lg' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div className={`h-12 ${config.mobile_only ? 'md:hidden' : ''}`} />
      <nav className={navClasses} style={navStyle}>
        <div className="flex items-center justify-around px-1 py-1 h-full">
          {items.map((item) => {
            const isActive = item.action_type === 'route' && item.size !== 'large' && (
              location.pathname === item.route_path ||
              (item.route_path === '/' && location.pathname === '/index') ||
              (item.route_path !== '/' && location.pathname.startsWith(item.route_path))
            );
            const dynamicBadge = item.requires_auth && unreadCount > 0 && item.size !== 'large'
              ? { ...item, badge: unreadCount > 9 ? '9+' : String(unreadCount) }
              : item;
            return <DynamicNavItem key={item.id} item={dynamicBadge} isActive={isActive} navigate={navigate} user={user} />;
          })}
        </div>
      </nav>
    </>
  );
};

const MobileBottomNav = () => {
  const { config, items, useFallback } = useBottomNav();
  if (useFallback) return <FallbackNav />;
  return <DynamicNav config={config!} items={items} />;
};

export default MobileBottomNav;

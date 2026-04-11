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
    className="relative flex flex-col items-center justify-center w-14 py-1"
    whileTap={{ scale: 0.85 }}
  >
    <motion.div
      className="relative -mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent/80 shadow-lg shadow-accent/30"
      whileHover={{ scale: 1.1 }}
      animate={{ boxShadow: ['0 4px 14px 0 hsl(var(--accent)/0.3)', '0 4px 20px 0 hsl(var(--accent)/0.5)', '0 4px 14px 0 hsl(var(--accent)/0.3)'] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Icon className="h-5 w-5 text-accent-foreground" />
    </motion.div>
    <span className="mt-0.5 text-[9px] font-semibold text-accent">{label}</span>
  </motion.button>
);

// ── Regular nav item ──
const NavItem = ({ icon: Icon, label, isActive, onClick, badge }: { icon: React.ElementType; label: string; isActive: boolean; onClick: () => void; badge?: number }) => (
  <motion.button
    onClick={onClick}
    className="relative flex flex-col items-center justify-center w-14 py-1 transition-colors text-muted-foreground"
    whileTap={{ scale: 0.85 }}
  >
    <AnimatePresence>
      {isActive && (
        <motion.div layoutId="mobile-nav-bg" className="absolute top-0.5 h-8 w-8 rounded-xl bg-accent/10" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }} />
      )}
    </AnimatePresence>
    {isActive && (
      <motion.div layoutId="mobile-nav-indicator" className="absolute -top-1.5 h-0.5 w-8 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
    )}
    <motion.div className="relative z-10 flex h-8 w-8 items-center justify-center" animate={isActive ? { scale: 1.1 } : { scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
      <Icon className={`h-[18px] w-[18px] transition-colors duration-200 ${isActive ? 'text-accent' : ''}`} />
      {badge && badge > 0 && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-0.5 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-destructive-foreground">
          {badge > 9 ? '9+' : badge}
        </motion.span>
      )}
    </motion.div>
    <AnimatePresence>
      {isActive ? (
        <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="mt-0 text-[9px] font-bold text-accent">{label}</motion.span>
      ) : (
        <span className="mt-0 text-[9px] font-medium">{label}</span>
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
      <div className="h-16 md:hidden" />
      <nav
        className="fixed bottom-0 left-0 right-0 border-t border-border/40 bg-card/90 backdrop-blur-xl supports-[backdrop-filter]:bg-card/80 md:hidden"
        style={{ zIndex: 1000, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around px-2 py-1.5">
          <NavItem icon={Home} label="Início" isActive={location.pathname === '/' || location.pathname === '/index'} onClick={() => navigate('/')} />
          <NavItem icon={Search} label="Buscar" isActive={location.pathname === '/buscar'} onClick={() => navigate('/buscar')} />
          <FabButton icon={Plus} label="Criar" onClick={handleCriar} />
          <NavItem icon={LayoutGrid} label="Categorias" isActive={location.pathname === '/categorias'} onClick={() => navigate('/categorias')} />
          <NavItem icon={User} label="Perfil" isActive={location.pathname.startsWith('/dashboard')} onClick={() => navigate(user ? '/dashboard' : '/login')} badge={unreadCount} />
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
      <div className={`h-16 ${config.mobile_only ? 'md:hidden' : ''}`} />
      <nav className={navClasses} style={navStyle}>
        <div className="flex items-center justify-around px-2 py-1.5 h-full">
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

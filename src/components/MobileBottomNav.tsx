import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, LayoutGrid, User, MessageCircle } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { motion, AnimatePresence } from 'framer-motion';
import { useBottomNav, type BottomNavItem, type BottomNavConfig } from '@/hooks/useBottomNav';

// ── Icon resolver ──
const getIcon = (name: string): React.ElementType => {
  const icons = LucideIcons as Record<string, any>;
  return icons[name] || Home;
};

// ── Fallback (hardcoded original) ──
const FallbackNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  const hiddenPaths = ['/admin', '/login', '/cadastro', '/reset-password', '/dashboard', '/sponsor-panel'];
  const shouldHide = hiddenPaths.some(p => location.pathname.startsWith(p));
  if (shouldHide) return null;

  const handleWhatsApp = () => {
    window.open('https://wa.me/5511999999999?text=Olá! Preciso de ajuda.', '_blank');
  };

  const items = [
    { icon: Home, label: 'Home', path: '/', active: location.pathname === '/' || location.pathname === '/index' },
    { icon: Search, label: 'Buscar', path: '/buscar', active: location.pathname === '/buscar' },
    { icon: LayoutGrid, label: 'Categorias', path: '/categorias', active: location.pathname === '/categorias' },
    { icon: User, label: 'Perfil', path: user ? '/dashboard' : '/login', active: location.pathname.startsWith('/dashboard') },
    { icon: MessageCircle, label: 'WhatsApp', action: handleWhatsApp, isWhatsApp: true },
  ];

  return (
    <>
      <div className="h-16 md:hidden" />
      <nav
        className="fixed bottom-0 left-0 right-0 border-t border-border/40 bg-card/90 backdrop-blur-xl supports-[backdrop-filter]:bg-card/80 md:hidden"
        style={{ zIndex: 1000, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around px-2 py-1.5">
          {items.map((item, i) => {
            const Icon = item.icon;
            const isActive = item.active;

            if (item.isWhatsApp) {
              return (
                <motion.button key={i} onClick={item.action} className="relative flex flex-col items-center justify-center w-14 py-1" style={{ color: '#25D366' }} whileTap={{ scale: 0.85 }}>
                  <motion.div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#25D366]/10" whileHover={{ scale: 1.1 }}>
                    <Icon className="h-[18px] w-[18px]" />
                  </motion.div>
                  <span className="mt-0.5 text-[9px] font-semibold">WhatsApp</span>
                </motion.button>
              );
            }

            return (
              <motion.button
                key={i}
                onClick={() => { if (item.action) item.action(); else if (item.path) navigate(item.path); }}
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
                  {item.label === 'Perfil' && unreadCount > 0 && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-0.5 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-destructive-foreground">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </motion.div>
                <AnimatePresence>
                  {isActive ? (
                    <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="mt-0 text-[9px] font-bold text-accent">{item.label}</motion.span>
                  ) : (
                    <span className="mt-0 text-[9px] font-medium">{item.label}</span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

// ── Dynamic nav item ──
const DynamicNavItem = ({ item, isActive, navigate, user }: { item: BottomNavItem; isActive: boolean; navigate: (path: string) => void; user: any }) => {
  const Icon = getIcon(item.icon);
  const activeColor = item.active_color || undefined;

  const handleClick = () => {
    if (item.requires_auth && !user) {
      navigate('/login');
      return;
    }

    switch (item.action_type) {
      case 'external':
        window.open(item.external_url || item.route_path, '_blank');
        break;
      case 'route':
      default:
        navigate(item.route_path);
        break;
    }
  };

  const isExternal = item.action_type === 'external';

  return (
    <motion.button
      onClick={handleClick}
      className="relative flex flex-col items-center justify-center w-14 py-1 transition-colors text-muted-foreground"
      whileTap={{ scale: 0.85 }}
      style={isExternal ? { color: item.text_color || '#25D366' } : undefined}
    >
      {!isExternal && (
        <AnimatePresence>
          {isActive && (
            <motion.div layoutId="mobile-nav-bg-dyn" className="absolute top-0.5 h-8 w-8 rounded-xl bg-accent/10" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }} />
          )}
        </AnimatePresence>
      )}

      {!isExternal && isActive && (
        <motion.div layoutId="mobile-nav-indicator-dyn" className="absolute -top-1.5 h-0.5 w-8 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
      )}

      <motion.div
        className="relative z-10 flex h-8 w-8 items-center justify-center"
        animate={isActive ? { scale: 1.1 } : { scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={isExternal && item.background_color ? { backgroundColor: item.background_color, borderRadius: '0.75rem' } : undefined}
      >
        <Icon className={`h-[18px] w-[18px] transition-colors duration-200 ${isActive ? 'text-accent' : ''}`} style={activeColor && isActive ? { color: activeColor } : undefined} />

        {item.badge && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-destructive-foreground"
            style={item.badge_color ? { backgroundColor: item.badge_color } : undefined}
          >
            {item.badge}
          </motion.span>
        )}
      </motion.div>

      <AnimatePresence>
        {isActive ? (
          <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="mt-0 text-[9px] font-bold text-accent" style={activeColor ? { color: activeColor } : undefined}>
            {item.label}
          </motion.span>
        ) : (
          <span className="mt-0 text-[9px] font-medium" style={item.text_color ? { color: item.text_color } : undefined}>
            {item.label}
          </span>
        )}
      </AnimatePresence>
    </motion.button>
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
    ...(config.height ? { height: `${config.height}px` } : {}),
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
            const isActive = item.action_type === 'route' && (
              location.pathname === item.route_path ||
              (item.route_path === '/' && location.pathname === '/index') ||
              (item.route_path !== '/' && location.pathname.startsWith(item.route_path))
            );
            // Inject notification badge for auth-required items (e.g. Perfil)
            const dynamicBadge = item.requires_auth && unreadCount > 0
              ? { ...item, badge: unreadCount > 9 ? '9+' : String(unreadCount) }
              : item;
            return (
              <DynamicNavItem key={item.id} item={dynamicBadge} isActive={isActive} navigate={navigate} user={user} />
            );
          })}
        </div>
      </nav>
    </>
  );
};

// ── Main exported component ──
const MobileBottomNav = () => {
  const { config, items, useFallback } = useBottomNav();

  if (useFallback) {
    return <FallbackNav />;
  }

  return <DynamicNav config={config!} items={items} />;
};

export default MobileBottomNav;

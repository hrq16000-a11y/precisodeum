import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, LayoutGrid, User, MessageCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { motion, AnimatePresence } from 'framer-motion';

const MobileBottomNav = () => {
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
                <motion.button
                  key={i}
                  onClick={item.action}
                  className="relative flex flex-col items-center justify-center w-14 py-1"
                  style={{ color: '#25D366' }}
                  whileTap={{ scale: 0.85 }}
                >
                  <motion.div
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#25D366]/10"
                    whileHover={{ scale: 1.1 }}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </motion.div>
                  <span className="mt-0.5 text-[9px] font-semibold">WhatsApp</span>
                </motion.button>
              );
            }

            return (
              <motion.button
                key={i}
                onClick={() => {
                  if (item.action) { item.action(); }
                  else if (item.path) { navigate(item.path); }
                }}
                className="relative flex flex-col items-center justify-center w-14 py-1 transition-colors text-muted-foreground"
                whileTap={{ scale: 0.85 }}
              >
                {/* Active background glow */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="mobile-nav-bg"
                      className="absolute top-0.5 h-8 w-8 rounded-xl bg-accent/10"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    />
                  )}
                </AnimatePresence>

                {/* Top indicator pill */}
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute -top-1.5 h-0.5 w-8 rounded-full bg-accent"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}

                <motion.div
                  className="relative z-10 flex h-8 w-8 items-center justify-center"
                  animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <Icon className={`h-[18px] w-[18px] transition-colors duration-200 ${isActive ? 'text-accent' : ''}`} />
                  {/* Notification badge on Profile tab */}
                  {item.label === 'Perfil' && unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-0.5 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-destructive-foreground"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </motion.div>

                <AnimatePresence>
                  {isActive ? (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="mt-0 text-[9px] font-bold text-accent"
                    >
                      {item.label}
                    </motion.span>
                  ) : (
                    <span className="mt-0 text-[9px] font-medium">
                      {item.label}
                    </span>
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

export default MobileBottomNav;

import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Plus, User, Bell, Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useRef } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const { unreadCount } = useNotifications();
  const menuRef = useRef<HTMLDivElement>(null);

  const profileType = profile?.profile_type || 'client';
  const isProvider = profileType === 'provider';
  const isRH = profileType === 'rh';

  // Close menu on route change
  useEffect(() => {
    setShowMenu(false);
  }, [location.pathname]);

  // Close menu on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showMenu) setShowMenu(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showMenu]);

  // Close menu on click outside
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  // Don't show on admin, login, signup, or dashboard (has its own nav)
  const hiddenPaths = ['/admin', '/login', '/cadastro', '/reset-password', '/dashboard', '/sponsor-panel'];
  const shouldHide = hiddenPaths.some(p => location.pathname.startsWith(p));
  if (shouldHide) return null;

  const handleCreate = () => {
    if (!user) { navigate('/cadastro'); return; }
    if (isProvider) { navigate('/dashboard/servicos'); }
    else if (isRH) { navigate('/dashboard/vagas'); }
    else { navigate('/cadastro'); }
  };

  const items = [
    { icon: Home, label: 'Início', path: '/', active: location.pathname === '/' || location.pathname === '/index' },
    { icon: Search, label: 'Buscar', path: '/buscar', active: location.pathname === '/buscar' },
    { icon: Plus, label: 'Criar', action: handleCreate, isCreate: true },
    { icon: User, label: 'Perfil', path: user ? '/dashboard' : '/login', active: location.pathname.startsWith('/dashboard') },
    { icon: Menu, label: 'Menu', action: () => setShowMenu(!showMenu) },
  ];

  return (
    <>
      {/* Spacer */}
      <div className="h-16 md:hidden" />

      <nav
        ref={menuRef}
        className="fixed bottom-0 left-0 right-0 border-t border-border/60 bg-card/95 backdrop-blur-lg supports-[backdrop-filter]:bg-card/85 md:hidden"
        style={{ zIndex: 1000, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around px-1 py-0.5">
          {items.map((item, i) => {
            const Icon = item.icon;
            const isActive = item.active;

            if (item.isCreate) {
              return (
                <button
                  key={i}
                  onClick={item.action}
                  className="flex flex-col items-center justify-center -mt-3"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md">
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="mt-0.5 text-[9px] font-semibold text-accent">Criar</span>
                </button>
              );
            }

            // Show badge on Menu icon for unread notifications
            const showBadge = item.label === 'Menu' && unreadCount > 0;

            return (
              <button
                key={i}
                onClick={() => {
                  if (item.action) { item.action(); }
                  else if (item.path) { navigate(item.path); }
                }}
                className={`relative flex flex-col items-center justify-center px-2 py-0.5 transition-colors ${
                  isActive ? 'text-accent' : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-[17px] w-[17px]" />
                {showBadge && (
                  <span className="absolute -right-0.5 top-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-destructive-foreground">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                <span className="mt-0.5 text-[9px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick menu */}
        {showMenu && (
          <div className="absolute bottom-full left-0 right-0 z-50 mb-1 mx-3 rounded-xl border border-border bg-card p-3 shadow-lg animate-in slide-in-from-bottom-2 duration-200">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Vagas', path: '/vagas' },
                { label: 'Notícias', path: '/blog' },
                { label: 'Como Funciona', path: '/sobre' },
                { label: 'FAQ', path: '/faq' },
                { label: 'Categorias', path: '/categorias' },
                { label: 'Cidades', path: '/cidades' },
              ].map(link => (
                <button
                  key={link.path}
                  onClick={() => { navigate(link.path); setShowMenu(false); }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted text-left"
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>
    </>
  );
};

export default MobileBottomNav;

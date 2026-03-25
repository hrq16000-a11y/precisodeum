import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Plus, User, Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  const profileType = profile?.profile_type || 'client';
  const isProvider = profileType === 'provider';
  const isRH = profileType === 'rh';

  // Don't show on admin, login, signup, or dashboard (has its own nav)
  const hiddenPaths = ['/admin', '/login', '/cadastro', '/reset-password', '/dashboard', '/sponsor-panel'];
  const shouldHide = hiddenPaths.some(p => location.pathname.startsWith(p));
  if (shouldHide) return null;

  const handleCreate = () => {
    if (!user) {
      navigate('/cadastro');
      return;
    }
    if (isProvider) {
      navigate('/dashboard/servicos');
    } else if (isRH) {
      navigate('/dashboard/vagas');
    } else {
      navigate('/cadastro');
    }
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
      {/* Spacer to prevent content from being hidden behind the nav */}
      <div className="h-14 md:hidden" />

      <nav className="fixed bottom-0 left-0 right-0 z-[60] border-t border-border/60 bg-card/95 backdrop-blur-lg supports-[backdrop-filter]:bg-card/85 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around px-1 py-1">
          {items.map((item, i) => {
            const Icon = item.icon;
            const isActive = item.active;

            if (item.isCreate) {
              return (
                <button
                  key={i}
                  onClick={item.action}
                  className="flex flex-col items-center justify-center -mt-3.5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md">
                    <Plus className="h-5 w-5" />
                  </div>
                  <span className="mt-0.5 text-[9px] font-semibold text-accent">Criar</span>
                </button>
              );
            }

            return (
              <button
                key={i}
                onClick={() => {
                  if (item.action) {
                    item.action();
                  } else if (item.path) {
                    navigate(item.path);
                  }
                }}
                className={`flex flex-col items-center justify-center px-2 py-0.5 transition-colors ${
                  isActive ? 'text-accent' : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="mt-0.5 text-[9px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick menu overlay */}
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40 bg-foreground/20" onClick={() => setShowMenu(false)} />
            <div className="absolute bottom-full left-0 right-0 z-50 mb-1 mx-3 rounded-xl border border-border bg-card p-3 shadow-lg animate-in slide-in-from-bottom-2 duration-200">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Vagas', path: '/vagas' },
                  { label: 'Notícias', path: '/blog' },
                  { label: 'Sobre', path: '/sobre' },
                  { label: 'FAQ', path: '/faq' },
                ].map(link => (
                  <button
                    key={link.path}
                    onClick={() => { navigate(link.path); setShowMenu(false); }}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted text-left"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </nav>
    </>
  );
};

export default MobileBottomNav;

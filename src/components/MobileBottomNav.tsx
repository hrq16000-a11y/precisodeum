import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, LayoutGrid, User, MessageCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useRef } from 'react';

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // Don't show on admin, login, signup, or dashboard (has its own nav)
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
      {/* Spacer */}
      <div className="h-14 md:hidden" />

      <nav
        className="fixed bottom-0 left-0 right-0 border-t border-border/60 bg-card/95 backdrop-blur-lg supports-[backdrop-filter]:bg-card/85 md:hidden"
        style={{ zIndex: 1000, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around px-1 py-1">
          {items.map((item, i) => {
            const Icon = item.icon;
            const isActive = item.active;

            if (item.isWhatsApp) {
              return (
                <button
                  key={i}
                  onClick={item.action}
                  className="flex flex-col items-center justify-center px-2 py-0.5"
                  style={{ color: '#25D366' }}
                >
                  <Icon className="h-[17px] w-[17px]" />
                  <span className="mt-0.5 text-[9px] font-medium">WhatsApp</span>
                </button>
              );
            }

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
                <span className="mt-0.5 text-[9px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;

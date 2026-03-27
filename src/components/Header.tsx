import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, Search, LogOut, LayoutDashboard, Users, MapPin, Briefcase, Newspaper, HelpCircle, Grid3X3, MapPinned } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSettingValue } from '@/hooks/useSiteSettings';

const DEFAULT_LOGO_URL = '/lovable-uploads/logo.png';

/** Detect user city via free IP geolocation */
function useGeoCity() {
  const [city, setCity] = useState<string | null>(null);
  useEffect(() => {
    const cached = sessionStorage.getItem('geo_city');
    if (cached) { setCity(cached); return; }
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => {
        const c = d?.city || null;
        if (c) { setCity(c); sessionStorage.setItem('geo_city', c); }
      })
      .catch(() => {});
  }, []);
  return city;
}

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut, loading } = useAuth();
  const whatsappGroupUrl = useSettingValue('whatsapp_group_url');
  const logoUrl = useSettingValue('logo_url');
  const logo = logoUrl || DEFAULT_LOGO_URL;
  const geoCity = useGeoCity();

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Close mobile menu on route change
  useEffect(() => {
    closeMobile();
  }, [location.pathname, closeMobile]);

  // Close mobile menu on ESC
  useEffect(() => {
    if (!mobileOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobile();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [mobileOpen, closeMobile]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Primary nav links for mobile (grouped for clarity)
  const primaryLinks = [
    { to: '/buscar', label: 'Buscar Profissionais', icon: Search },
    { to: '/vagas', label: 'Vagas', icon: Briefcase },
    { to: '/blog', label: 'Notícias', icon: Newspaper },
  ];

  const secondaryLinks = [
    { to: '/categorias', label: 'Categorias', icon: Grid3X3 },
    { to: '/cidades', label: 'Cidades', icon: MapPinned },
    { to: '/sobre', label: 'Como Funciona', icon: HelpCircle },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/80 shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="container flex h-14 items-center justify-between md:h-16">
        {/* Logo + Geo */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center">
            <img src={logo} alt="Preciso de um - Profissionais Confiáveis Perto de Você" className="h-10 md:h-12 drop-shadow-[0_1px_2px_rgba(0,0,0,0.08)] object-contain" width="166" height="48" />
          </Link>
          {geoCity && (
            <span className="hidden items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
              <MapPin className="h-3 w-3 text-accent" />
              {geoCity}
            </span>
          )}
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-5 md:flex">
          <Link to="/buscar" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Buscar</Link>
          <Link to="/vagas" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Vagas</Link>
          <Link to="/blog" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Notícias</Link>
          <Link to="/sobre" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Como Funciona</Link>
          <Link to="/cadastro" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Seja Profissional</Link>
          {whatsappGroupUrl && (
            <a
              href={whatsappGroupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#25D366] transition-colors hover:text-[#128C7E]"
            >
              <Users className="h-4 w-4" />
              Grupo
            </a>
          )}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" size="sm" onClick={() => navigate('/buscar')}>
            <Search className="h-4 w-4" />
          </Button>
          {!loading && user ? (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
                <LayoutDashboard className="mr-1 h-4 w-4" />
                {profile?.full_name?.split(' ')[0] || 'Dashboard'}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate('/login')}>Entrar</Button>
              <Button variant="accent" size="sm" onClick={() => navigate('/cadastro')}>Cadastrar</Button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <div className="flex items-center gap-2 md:hidden">
          {geoCity && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <MapPin className="h-3 w-3 text-accent" />
              {geoCity}
            </span>
          )}
          <button
            ref={toggleRef}
            className="relative z-[60] rounded-md p-1.5 text-foreground transition-colors hover:bg-muted"
            onClick={() => setMobileOpen(prev => !prev)}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      {mobileOpen && (
        <>
          {/* Full-screen overlay - closes on tap */}
          <div
            className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px] md:hidden animate-in fade-in duration-200"
            onClick={closeMobile}
            aria-hidden="true"
          />

          {/* Menu panel */}
          <div
            ref={menuRef}
            className="fixed left-0 right-0 top-14 z-50 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-t border-border bg-card shadow-xl md:hidden animate-in slide-in-from-top-2 duration-200"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            <nav className="flex flex-col p-3 gap-1">
              {/* Primary links */}
              {primaryLinks.map(link => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={closeMobile}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-accent/10 text-accent'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {link.label}
                  </Link>
                );
              })}

              {/* Separator */}
              <div className="my-1 border-t border-border/60" />

              {/* Secondary links */}
              {secondaryLinks.map(link => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={closeMobile}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-accent/10 text-accent'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {link.label}
                  </Link>
                );
              })}

              {/* WhatsApp */}
              {whatsappGroupUrl && (
                <a
                  href={whatsappGroupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#25D366] hover:bg-muted"
                  onClick={closeMobile}
                >
                  <Users className="h-4 w-4 shrink-0" />
                  Grupo WhatsApp
                </a>
              )}

              {/* Separator */}
              <div className="my-1 border-t border-border/60" />

              {/* Auth section */}
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    onClick={closeMobile}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    {profile?.full_name?.split(' ')[0] || 'Dashboard'}
                  </Link>
                  <button
                    onClick={() => { handleSignOut(); closeMobile(); }}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    Sair
                  </button>
                </>
              ) : (
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { navigate('/login'); closeMobile(); }}>
                    Entrar
                  </Button>
                  <Button variant="accent" size="sm" className="flex-1" onClick={() => { navigate('/cadastro'); closeMobile(); }}>
                    Cadastrar
                  </Button>
                </div>
              )}
            </nav>
          </div>
        </>
      )}
    </header>
  );
};

export default Header;

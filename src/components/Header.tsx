import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, Search, LogOut, LayoutDashboard, Users, MapPin, Thermometer } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { useGeoCity } from '@/hooks/useGeoCity';
import { NotificationBell } from '@/components/NotificationCenter';
import { useMenuItems } from '@/hooks/useMenuItems';

const DEFAULT_LOGO_URL = '/lovable-uploads/logo-transparent.png';

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut, loading } = useAuth();
  const whatsappGroupUrl = useSettingValue('whatsapp_group_url');
  const logoUrl = useSettingValue('logo_url');
  const logo = logoUrl || DEFAULT_LOGO_URL;
  const { city: geoCity, temp: geoTemp } = useGeoCity();
  const headerRef = useRef<HTMLElement>(null);

  const { data: headerItems = [] } = useMenuItems('header');
  const { data: mobileItems = [] } = useMenuItems('mobile');

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) setMobileOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Fallback hardcoded links when no DB menu items exist
  const fallbackHeaderLinks = [
    { label: 'Buscar', url: '/buscar' },
    { label: 'Vagas', url: '/vagas' },
    { label: 'Notícias', url: '/blog' },
    { label: 'Como Funciona', url: '/sobre' },
    { label: 'Seja Profissional', url: '/cadastro' },
  ];

  const fallbackMobileLinks = [
    { label: 'Buscar Profissionais', url: '/buscar' },
    { label: 'Vagas', url: '/vagas' },
    { label: 'Notícias', url: '/blog' },
    { label: 'Como Funciona', url: '/sobre' },
    { label: 'Categorias', url: '/categorias' },
    { label: 'Cidades', url: '/cidades' },
    { label: 'Seja Profissional', url: '/cadastro' },
  ];

  const navLinks = headerItems.length > 0 ? headerItems : fallbackHeaderLinks.map((l, i) => ({ ...l, id: `fb-${i}`, icon: '', open_in_new_tab: false, parent_id: null, display_order: i, active: true, menu_location: 'header' }));
  const mobileNavLinks = mobileItems.length > 0 ? mobileItems : (headerItems.length > 0 ? headerItems : fallbackMobileLinks.map((l, i) => ({ ...l, id: `fbm-${i}`, icon: '', open_in_new_tab: false, parent_id: null, display_order: i, active: true, menu_location: 'mobile' })));

  const GeoBadge = ({ className = '' }: { className?: string }) => {
    if (!geoCity) return null;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground ${className}`}>
        <MapPin className="h-3 w-3 text-accent" />
        {geoCity}
        {geoTemp !== null && (
          <>
            <span className="mx-0.5 text-border">·</span>
            <Thermometer className="h-3 w-3 text-accent" />
            {Math.round(geoTemp)}°C
          </>
        )}
      </span>
    );
  };

  const renderLink = (item: any, className: string, onClick?: () => void) => {
    if (item.open_in_new_tab || item.url?.startsWith('http')) {
      return (
        <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
          {item.icon && <span className="mr-1">{item.icon}</span>}
          {item.label}
        </a>
      );
    }
    return (
      <Link key={item.id} to={item.url} className={className} onClick={onClick}>
        {item.icon && <span className="mr-1">{item.icon}</span>}
        {item.label}
      </Link>
    );
  };

  return (
    <header ref={headerRef} className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/80 shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="container flex h-14 items-center justify-between md:h-16">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center">
            <img src={logo} alt="Preciso de um - Profissionais Confiáveis Perto de Você" className="h-10 md:h-12 drop-shadow-[0_1px_2px_rgba(0,0,0,0.08)] object-contain" width="166" height="48" />
          </Link>
          <GeoBadge className="hidden sm:inline-flex" />
        </div>

        <nav className="hidden items-center gap-5 md:flex">
          {navLinks.filter(i => !i.parent_id).map(item =>
            renderLink(item, 'text-sm font-medium text-muted-foreground transition-colors hover:text-foreground')
          )}
          {whatsappGroupUrl && (
            <a href={whatsappGroupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#25D366] transition-colors hover:text-[#128C7E]">
              <Users className="h-4 w-4" />
              Grupo
            </a>
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" size="sm" onClick={() => navigate('/buscar')}>
            <Search className="h-4 w-4" />
          </Button>
          <NotificationBell />
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

        <div className="flex items-center gap-1.5 md:hidden">
          <GeoBadge className="text-[10px] px-1.5 py-0.5" />
          <NotificationBell />
          <button className="text-foreground" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu" aria-expanded={mobileOpen}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="relative z-50 border-t border-border bg-card p-4 md:hidden animate-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col gap-2">
              {mobileNavLinks.filter(i => !i.parent_id).map(item =>
                renderLink(item, 'rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted', () => setMobileOpen(false))
              )}
              {whatsappGroupUrl && (
                <a href={whatsappGroupUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg px-3 py-2 text-sm font-medium text-[#25D366] hover:bg-muted flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                  <Users className="h-4 w-4" />
                  Grupo WhatsApp
                </a>
              )}
              <hr className="border-border" />
              {user ? (
                <>
                  <Link to="/dashboard" className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted" onClick={() => setMobileOpen(false)}>Dashboard</Link>
                  <button onClick={() => { handleSignOut(); setMobileOpen(false); }} className="rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted">Sair</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted" onClick={() => setMobileOpen(false)}>Entrar</Link>
                  <Button variant="accent" size="sm" onClick={() => { navigate('/cadastro'); setMobileOpen(false); }}>Cadastrar</Button>
                </>
              )}
            </nav>
          </div>
      )}
    </header>
  );
};

export default Header;

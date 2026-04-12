import { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react';
import { importWithRetry } from '@/lib/lazyWithRetry';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Menu, X, Search, LogOut, LayoutDashboard, Users, MapPin, Thermometer, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { useGeoCity } from '@/hooks/useGeoCity';
const LazyNotificationBell = lazy(() => importWithRetry(() => import('@/components/NotificationCenter').then(m => ({ default: m.NotificationBell }))));
const NotificationBell = (props: any) => (
  <Suspense fallback={<span className="h-5 w-5" />}>
    <LazyNotificationBell {...props} />
  </Suspense>
);
import { useMenuItems } from '@/hooks/useMenuItems';

const DEFAULT_LOGO_URL = '/lovable-uploads/logo-transparent.png';

/* ── Geo badge (full & compact) ───────────────────────────── */
const GeoBadge = ({ city, temp, compact = false, className = '' }: { city: string | null; temp: number | null; compact?: boolean; className?: string }) => {
  if (!city) return null;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ${className}`}>
        <MapPin className="h-3 w-3 text-accent" />
        {city.length > 12 ? city.slice(0, 12) + '…' : city}
        {temp !== null && (
          <>
            <span className="mx-0.5 text-border">·</span>
            {Math.round(temp)}°
          </>
        )}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-all duration-500 ease-out ${className}`}
    >
      <MapPin className="h-3 w-3 text-accent" />
      {city}
      {temp !== null && (
        <>
          <span className="mx-0.5 text-border">·</span>
          <Thermometer className="h-3 w-3 text-accent" />
          {Math.round(temp)}°C
        </>
      )}
    </span>
  );
};

/* ── Compact inline search (appears after scroll) ─────────── */
const CompactSearch = ({ onSubmit }: { onSubmit: (q: string) => void }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSubmit(query.trim());
      setQuery('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative hidden md:block">
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar serviços..."
        className="h-8 w-44 pl-8 text-xs rounded-full bg-muted/50 border-transparent focus:border-accent/30 transition-all duration-300"
      />
    </form>
  );
};

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut, loading } = useAuth();
  const whatsappGroupUrl = useSettingValue('whatsapp_group_url');
  const logoUrl = useSettingValue('logo_url');
  const logo = logoUrl || DEFAULT_LOGO_URL;
  const { city: geoCity, temp: geoTemp } = useGeoCity();
  const headerRef = useRef<HTMLElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Admin settings for compact header
  const compactEnabled = useSettingValue('header_compact_enabled');
  const isCompactEnabled = compactEnabled !== 'false'; // default true

  const { data: headerItems = [] } = useMenuItems('header');
  const { data: mobileItems = [] } = useMenuItems('mobile');

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  const handleSearchSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/buscar?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  }, [searchQuery, navigate]);

  const handleCompactSearch = useCallback((q: string) => {
    navigate(`/buscar?q=${encodeURIComponent(q)}`);
  }, [navigate]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const isCompact = isCompactEnabled && scrolled;

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

  const isActiveLink = (url: string) => location.pathname === url;

  const renderLink = (item: any, className: string, onClick?: () => void) => {
    const active = isActiveLink(item.url);
    const activeClass = active ? 'text-foreground' : '';

    if (item.open_in_new_tab || item.url?.startsWith('http')) {
      return (
        <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className={`${className} ${activeClass}`} onClick={onClick}>
          {item.label}
        </a>
      );
    }
    return (
      <Link key={item.id} to={item.url} className={`relative ${className} ${activeClass}`} onClick={onClick}>
        {item.label}
        {active && (
          <div className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-accent" />
        )}
      </Link>
    );
  };

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-50 border-b border-border transition-all duration-300 ease-in-out ${
        isCompact
          ? 'bg-card backdrop-blur-lg shadow-md'
          : 'bg-card shadow-none'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div
        className={`container flex items-center justify-between px-2 sm:px-4 transition-all duration-300 ease-in-out ${
          isCompact ? 'h-12 md:h-14' : 'h-14 md:h-16'
        }`}
      >
        {/* Left: Logo + Geo */}
        <div className="flex items-center gap-2 -ml-1 sm:-ml-2">
          <Link to="/" className="flex items-center">
            <img
              src={logo}
              alt="Preciso de um - Profissionais Confiáveis Perto de Você"
              className={`drop-shadow-[0_1px_2px_rgba(0,0,0,0.08)] object-contain transition-all duration-300 ease-in-out ${
                isCompact ? 'h-8 md:h-9' : 'h-10 md:h-12'
              }`}
              width="166"
              height="48"
              fetchPriority="high"
            />
          </Link>

          {/* Full geo badge — hidden when compact on desktop */}
          <GeoBadge
            city={geoCity}
            temp={geoTemp}
            className={`hidden sm:inline-flex transition-all duration-300 ${
              isCompact ? 'opacity-0 w-0 overflow-hidden pointer-events-none' : 'opacity-100'
            }`}
          />

          {/* Compact geo badge — only visible when compact on desktop */}
          {isCompact && (
            <GeoBadge
              city={geoCity}
              temp={geoTemp}
              compact
              className="hidden sm:inline-flex animate-fade-in"
            />
          )}
        </div>

        {/* Center: nav links (hidden when compact, replaced by search) */}
        <nav className={`hidden items-center gap-5 md:flex transition-all duration-300 ${
          isCompact ? 'gap-3' : 'gap-5'
        }`}>
          {isCompact ? (
            <>
              <CompactSearch onSubmit={handleCompactSearch} />
              {navLinks.filter(i => !i.parent_id).slice(0, 3).map(item =>
                renderLink(item, 'text-xs font-medium text-muted-foreground transition-colors hover:text-foreground whitespace-nowrap')
              )}
            </>
          ) : (
            <>
              {navLinks.filter(i => !i.parent_id).map(item =>
                renderLink(item, 'text-sm font-medium text-muted-foreground transition-colors hover:text-foreground')
              )}
              {whatsappGroupUrl && (
                <a href={whatsappGroupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#25D366] transition-colors hover:text-[#128C7E]">
                  <Users className="h-4 w-4" />
                  Grupo
                </a>
              )}
            </>
          )}
        </nav>

        {/* Right: actions (desktop) */}
        <div className="hidden items-center gap-2 md:flex">
          {!isCompact && searchOpen && (
            <form
              onSubmit={handleSearchSubmit}
              className="overflow-hidden animate-scale-in"
              style={{ width: 200 }}
            >
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar serviços..."
                className="h-8 text-sm"
                onBlur={() => { if (!searchQuery) setSearchOpen(false); }}
                onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); } }}
              />
            </form>
          )}
          {!isCompact && (
            <Button variant="ghost" size="sm" onClick={() => searchOpen ? handleSearchSubmit() : setSearchOpen(true)} className="hover:bg-accent/10">
              <Search className="h-4 w-4" />
            </Button>
          )}
          <NotificationBell />
          {!loading && user ? (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')} className={`gap-1.5 ${isCompact ? 'text-xs h-7 px-2' : ''}`}>
                <LayoutDashboard className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                {profile?.full_name?.split(' ')[0] || 'Dashboard'}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className={`hover:bg-destructive/10 hover:text-destructive ${isCompact ? 'h-7 w-7 p-0' : ''}`}>
                <LogOut className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size={isCompact ? 'sm' : 'sm'} className={isCompact ? 'text-xs h-7' : ''} onClick={() => navigate('/login')}>Entrar</Button>
              <Button variant="accent" size={isCompact ? 'sm' : 'sm'} className={isCompact ? 'text-xs h-7' : ''} onClick={() => navigate('/cadastro')}>Cadastrar</Button>
            </>
          )}
        </div>

        {/* Mobile right actions */}
        <div className="flex items-center gap-1.5 md:hidden">
          {isCompact ? (
            <>
              {/* Compact search on mobile */}
              <form onSubmit={handleCompactSearch} className="flex-1 min-w-0 mr-1">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar..."
                  className="h-7 text-xs rounded-full bg-muted border-0 px-3"
                  onKeyDown={(e) => { if (e.key === 'Escape') setSearchQuery(''); }}
                />
              </form>
              <GeoBadge city={geoCity} temp={geoTemp} compact className="text-[10px] px-1.5 py-0.5 shrink-0" />
            </>
          ) : (
            <GeoBadge city={geoCity} temp={geoTemp} className="text-[10px] px-1.5 py-0.5" />
          )}
          <NotificationBell />
          <button
            className="text-foreground p-1 rounded-lg active:scale-90 transition-transform shrink-0"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="overflow-hidden border-t border-border glass-strong md:hidden animate-scale-in">
          <nav className="flex flex-col gap-0.5 p-3">
            {mobileNavLinks.filter(i => !i.parent_id).map((item, index) => {
              const active = isActiveLink(item.url);
              return (
                <div
                  key={item.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'both' }}
                >
                  {item.open_in_new_tab || item.url?.startsWith('http') ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${active ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-muted'}`}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="flex items-center gap-2">{item.label}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </a>
                  ) : (
                    <Link
                      to={item.url}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${active ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-muted'}`}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="flex items-center gap-2">{item.label}</span>
                      {active ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                    </Link>
                  )}
                </div>
              );
            })}
            {whatsappGroupUrl && (
              <a
                href={whatsappGroupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-[#25D366] hover:bg-[#25D366]/10 animate-fade-in"
                style={{ animationDelay: `${mobileNavLinks.length * 40}ms`, animationFillMode: 'both' }}
                onClick={() => setMobileOpen(false)}
              >
                <Users className="h-4 w-4" />
                Grupo WhatsApp
              </a>
            )}
            <hr className="border-border my-1" />
            {user ? (
              <>
                <Link to="/dashboard" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted animate-fade-in" style={{ animationDelay: '250ms', animationFillMode: 'both' }} onClick={() => setMobileOpen(false)}>
                  <LayoutDashboard className="h-4 w-4 text-accent" />
                  Dashboard
                </Link>
                <button onClick={() => { handleSignOut(); setMobileOpen(false); }} className="flex items-center gap-2 w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-destructive/80 hover:bg-destructive/10 animate-fade-in" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </>
            ) : (
              <div className="flex gap-2 pt-1 animate-fade-in" style={{ animationDelay: '250ms', animationFillMode: 'both' }}>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { navigate('/login'); setMobileOpen(false); }}>Entrar</Button>
                <Button variant="accent" size="sm" className="flex-1" onClick={() => { navigate('/cadastro'); setMobileOpen(false); }}>Cadastrar</Button>
              </div>
            )}
          </nav>
        </div>
      )}
      <Suspense fallback={null}>
        <AdSlot slotSlug="global-top" />
      </Suspense>
    </header>
  );
};

const AdSlot = lazy(() => importWithRetry(() => import('@/components/ads/AdSlot')));

export default Header;

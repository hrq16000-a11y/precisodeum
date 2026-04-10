import { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Menu, X, Search, LogOut, LayoutDashboard, Users, MapPin, Thermometer, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { useGeoCity } from '@/hooks/useGeoCity';
import { NotificationBell } from '@/components/NotificationCenter';
import { useMenuItems } from '@/hooks/useMenuItems';
import { motion, AnimatePresence } from 'framer-motion';

const DEFAULT_LOGO_URL = '/lovable-uploads/logo-transparent.png';

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

  const { data: headerItems = [] } = useMenuItems('header');
  const { data: mobileItems = [] } = useMenuItems('mobile');

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Track scroll for header shadow intensity
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
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

  // Inline search handlers
  const handleSearchSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/buscar?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  }, [searchQuery, navigate]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

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
      <motion.span
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground ${className}`}
      >
        <MapPin className="h-3 w-3 text-accent" />
        {geoCity}
        {geoTemp !== null && (
          <>
            <span className="mx-0.5 text-border">·</span>
            <Thermometer className="h-3 w-3 text-accent" />
            {Math.round(geoTemp)}°C
          </>
        )}
      </motion.span>
    );
  };

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
          <motion.div
            layoutId="header-nav-indicator"
            className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-accent"
            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
          />
        )}
      </Link>
    );
  };

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/80 transition-shadow duration-300 ${scrolled ? 'shadow-md' : 'shadow-sm'}`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="container flex h-14 items-center justify-between md:h-16">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center">
            <motion.img
              src={logo}
              alt="Preciso de um - Profissionais Confiáveis Perto de Você"
              className="h-10 md:h-12 drop-shadow-[0_1px_2px_rgba(0,0,0,0.08)] object-contain"
              width="166"
              height="48"
              initial={{ opacity: 0, filter: 'brightness(2) blur(6px)' }}
              animate={{ opacity: 1, filter: 'brightness(1) blur(0px)' }}
              transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
            />
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
          <AnimatePresence>
            {searchOpen && (
              <motion.form
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 200, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                onSubmit={handleSearchSubmit}
                className="overflow-hidden"
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
              </motion.form>
            )}
          </AnimatePresence>
          <Button variant="ghost" size="sm" onClick={() => searchOpen ? handleSearchSubmit() : setSearchOpen(true)} className="hover:bg-accent/10">
            <Search className="h-4 w-4" />
          </Button>
          <NotificationBell />
          {!loading && user ? (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')} className="gap-1.5">
                <LayoutDashboard className="h-4 w-4" />
                {profile?.full_name?.split(' ')[0] || 'Dashboard'}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="hover:bg-destructive/10 hover:text-destructive">
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
          <motion.button
            className="text-foreground p-1 rounded-lg"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
            whileTap={{ scale: 0.9 }}
          >
            <AnimatePresence mode="wait">
              {mobileOpen ? (
                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <X className="h-5 w-5" />
                </motion.div>
              ) : (
                <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <Menu className="h-5 w-5" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Mobile menu with staggered animation */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden border-t border-border glass-strong md:hidden"
          >
            <nav className="flex flex-col gap-0.5 p-3">
              {mobileNavLinks.filter(i => !i.parent_id).map((item, index) => {
                const active = isActiveLink(item.url);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.2 }}
                  >
                    {item.open_in_new_tab || item.url?.startsWith('http') ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${active ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-muted'}`}
                        onClick={() => setMobileOpen(false)}
                      >
                        <span className="flex items-center gap-2">
                          {item.label}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                      </a>
                    ) : (
                      <Link
                        to={item.url}
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${active ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-muted'}`}
                        onClick={() => setMobileOpen(false)}
                      >
                        <span className="flex items-center gap-2">
                          {item.label}
                        </span>
                        {active ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                        )}
                      </Link>
                    )}
                  </motion.div>
                );
              })}
              {whatsappGroupUrl && (
                <motion.a
                  href={whatsappGroupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-[#25D366] hover:bg-[#25D366]/10"
                  onClick={() => setMobileOpen(false)}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: mobileNavLinks.length * 0.04 }}
                >
                  <Users className="h-4 w-4" />
                  Grupo WhatsApp
                </motion.a>
              )}
              <motion.hr
                className="border-border my-1"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              />
              {user ? (
                <>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
                    <Link to="/dashboard" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted" onClick={() => setMobileOpen(false)}>
                      <LayoutDashboard className="h-4 w-4 text-accent" />
                      Dashboard
                    </Link>
                  </motion.div>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                    <button onClick={() => { handleSignOut(); setMobileOpen(false); }} className="flex items-center gap-2 w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-destructive/80 hover:bg-destructive/10">
                      <LogOut className="h-4 w-4" />
                      Sair
                    </button>
                  </motion.div>
                </>
              ) : (
                <motion.div className="flex gap-2 pt-1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { navigate('/login'); setMobileOpen(false); }}>Entrar</Button>
                  <Button variant="accent" size="sm" className="flex-1" onClick={() => { navigate('/cadastro'); setMobileOpen(false); }}>Cadastrar</Button>
                </motion.div>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
      <Suspense fallback={null}>
        <AdSlot slotSlug="global-top" />
      </Suspense>
    </header>
  );
};

const AdSlot = lazy(() => importWithRetry(() => import('@/components/ads/AdSlot')));

export default Header;

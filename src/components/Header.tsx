import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, Search, LogOut, LayoutDashboard, Users, MapPin } from 'lucide-react';
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
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut, loading } = useAuth();
  const whatsappGroupUrl = useSettingValue('whatsapp_group_url');
  const logoUrl = useSettingValue('logo_url');
  const logo = logoUrl || DEFAULT_LOGO_URL;
  const geoCity = useGeoCity();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close mobile menu on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) setMobileOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [mobileOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/80 shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="container flex h-14 items-center justify-between md:h-16">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center">
            <img src={logo} alt="Preciso de um - Profissionais Confiáveis Perto de Você" className="h-9 md:h-10" width="111" height="40" />
          </Link>
          {geoCity && (
            <span className="hidden items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
              <MapPin className="h-3 w-3 text-accent" />
              {geoCity}
            </span>
          )}
        </div>

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

        <div className="flex items-center gap-2 md:hidden">
          {geoCity && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <MapPin className="h-3 w-3 text-accent" />
              {geoCity}
            </span>
          )}
          <button className="text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/20 md:hidden" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 border-t border-border bg-card p-4 md:hidden">
            <nav className="flex flex-col gap-2">
              <Link to="/buscar" className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted" onClick={() => setMobileOpen(false)}>Buscar Profissionais</Link>
              <Link to="/vagas" className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted" onClick={() => setMobileOpen(false)}>Vagas</Link>
              <Link to="/blog" className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted" onClick={() => setMobileOpen(false)}>Notícias</Link>
              <Link to="/sobre" className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted" onClick={() => setMobileOpen(false)}>Como Funciona</Link>
              <Link to="/categorias" className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted" onClick={() => setMobileOpen(false)}>Categorias</Link>
              <Link to="/cidades" className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted" onClick={() => setMobileOpen(false)}>Cidades</Link>
              <Link to="/cadastro" className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted" onClick={() => setMobileOpen(false)}>Seja Profissional</Link>
              {whatsappGroupUrl && (
                <a
                  href={whatsappGroupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-[#25D366] hover:bg-muted flex items-center gap-2"
                  onClick={() => setMobileOpen(false)}
                >
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
        </>
      )}
    </header>
  );
};

export default Header;

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useSettingValue } from '@/hooks/useSiteSettings';
import defaultLogo from '@/assets/logo.png';
import SponsorAd from '@/components/SponsorAd';

const ecosystemLinks = [
  { name: 'Encontre um Técnico', url: 'https://www.encontreumtecnico.com' },
  { name: 'Preciso de um Técnico', url: 'https://www.precisodeumtecnico.com' },
  { name: 'Encontre um Profissional', url: 'https://www.encontreumprofissional.com.br' },
  { name: 'Preciso de um Profissional', url: 'https://www.precisodeumprofissional.com.br' },
  { name: 'TamoNaWeb', url: 'https://www.TamoNaWeb.com.br' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const Footer = () => {
  const whatsappGroupUrl = useSettingValue('whatsapp_group_url');
  const logoFooterUrl = useSettingValue('logo_footer_url');
  const logoVertical = logoFooterUrl?.trim() ? logoFooterUrl.trim() : defaultLogo;
  const { data: topCities = [] } = useQuery({
    queryKey: ['footer-cities'],
    queryFn: async () => {
      const { data } = await supabase.from('cities').select('name, slug').order('name').limit(12);
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['footer-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('name, slug').order('name').limit(20);
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const randomSeoLinks = useMemo(() => {
    if (categories.length === 0 || topCities.length === 0) return [];
    const all = categories.flatMap((cat) =>
      topCities.map((city) => ({ cat, city }))
    );
    return shuffle(all).slice(0, 24);
  }, [categories, topCities]);

  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="container py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/">
              <img src={logoVertical} alt="Preciso de um" className="mb-4 h-20 max-w-[200px] object-contain brightness-0 invert" />
            </Link>
            <p className="text-sm leading-relaxed text-primary-foreground/70">
              A maior plataforma de serviços do Brasil. Conectamos você aos melhores profissionais da sua região com avaliações verificadas e contato direto.
            </p>
          </div>

          {/* Serviços Populares */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Serviços Populares</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              {categories.map((s) => (
                <li key={s.slug}>
                  <Link to={`/categoria/${s.slug}`} className="transition-colors hover:text-primary-foreground">{s.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Cidades */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Cidades</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              {topCities.map((city) => (
                <li key={city.slug}>
                  <Link to={`/cidade/${city.slug}`} className="transition-colors hover:text-primary-foreground">{city.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Profissionais */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Profissionais</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li><Link to="/cadastro" className="transition-colors hover:text-primary-foreground">Cadastro</Link></li>
              <li><Link to="/login" className="transition-colors hover:text-primary-foreground">Login</Link></li>
              <li><Link to="/dashboard" className="transition-colors hover:text-primary-foreground">Dashboard</Link></li>
              <li><Link to="/buscar" className="transition-colors hover:text-primary-foreground">Buscar Profissionais</Link></li>
              <li><Link to="/sobre" className="transition-colors hover:text-primary-foreground">Sobre</Link></li>
            </ul>
          </div>

          {/* Ecossistema */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Ecossistema</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              {ecosystemLinks.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-primary-foreground">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Contato</h4>
            <ul className="space-y-3 text-sm text-primary-foreground/70">
              <li>
                <a
                  href="https://wa.me/5541997452053"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-foreground/10 px-3 py-2 transition-colors hover:bg-primary-foreground/20"
                >
                  <MessageCircle className="h-4 w-4" />
                  (41) 99745-2053
                </a>
              </li>
              {whatsappGroupUrl && (
                <li>
                  <a
                    href={whatsappGroupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#25D366]/20 px-3 py-2 text-[#25D366] transition-colors hover:bg-[#25D366]/30"
                  >
                    <Users className="h-4 w-4" />
                    Grupo WhatsApp
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* SEO Links Grid - randomized */}
        <div className="mt-10 border-t border-primary-foreground/10 pt-6">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary-foreground/40">Buscas populares</h4>
          <div className="flex flex-wrap gap-2">
            {randomSeoLinks.map(({ cat, city }) => (
              <Link
                key={`${cat.slug}-${city.slug}`}
                to={`/${cat.slug}-${city.slug}`}
                className="text-xs text-primary-foreground/40 transition-colors hover:text-primary-foreground/70"
              >
                {cat.name} em {city.name}
              </Link>
            ))}
          </div>
        </div>

        <SponsorAd position="footer" layout="inline" className="mt-6 border-t border-primary-foreground/10 pt-6" />

        <div className="mt-6 border-t border-primary-foreground/10 pt-6 text-center text-xs text-primary-foreground/40">
          © 2026 Preciso de um. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};

export default Footer;

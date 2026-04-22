import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useMemo, lazy, Suspense } from 'react';
import { useSettingValue, useFeatureEnabled } from '@/hooks/useSiteSettings';
import { useMenuItemsByLocations } from '@/hooks/useMenuItems';
import { importWithRetry } from '@/lib/lazyWithRetry';
import Logo from '@/components/Logo';

const SponsorAd = lazy(() => importWithRetry(() => import('@/components/SponsorAd')));
const PwaFooterInstall = lazy(() => importWithRetry(() => import('@/components/PwaFooterInstall')));

const fallbackProfissionaisAll = [
  { label: 'Cadastro', url: '/cadastro' },
  { label: 'Login', url: '/login' },
  { label: 'Dashboard', url: '/dashboard' },
  { label: 'Buscar Profissionais', url: '/buscar' },
  { label: 'Vagas', url: '/vagas' },
  { label: 'Notícias', url: '/blog' },
  { label: 'Sobre', url: '/sobre' },
];

const fallbackEco = [
  { label: 'Mestre dos Serviços', url: 'https://mestredosservicos.com.br', open_in_new_tab: true },
  { label: 'Encontre um Técnico', url: 'https://www.encontreumtecnico.com', open_in_new_tab: true },
  { label: 'Preciso de um Técnico', url: 'https://www.precisodeumtecnico.com', open_in_new_tab: true },
  { label: 'Encontre um Profissional', url: 'https://www.encontreumprofissional.com.br', open_in_new_tab: true },
  { label: 'Preciso de um Profissional', url: 'https://www.precisodeumprofissional.com.br', open_in_new_tab: true },
  { label: 'TamoNaWeb', url: 'https://www.TamoNaWeb.com.br', open_in_new_tab: true },
];

const fallbackSuporte = [
  { label: 'Central de Ajuda', url: '/ajuda', open_in_new_tab: false, icon: 'HelpCircle' },
];

const footerTaglines = [
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Encontre serviços na sua cidade com contato direto e avaliações reais.' },
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Conectamos você a prestadores de serviços confiáveis perto de você.' },
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Compare, escolha e fale direto com profissionais da sua região.' },
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Profissionais avaliados, contato rápido e perfis completos próximos de você.' },
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Descubra prestadores de serviços na sua cidade com avaliações reais.' },
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Escolha, entre em contato e resolva seu serviço hoje mesmo.' },
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Encontre rapidamente quem você precisa e fale direto no WhatsApp.' },
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Do orçamento ao contato direto, tudo em um só lugar.' },
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Plataforma de serviços que conecta você a profissionais da sua região.' },
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Encontre prestadores de serviços locais com avaliações verificadas.' },
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Conectando você aos melhores prestadores de serviços em todo o Brasil.' },
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Serviços confiáveis perto de você.' },
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Encontre e fale direto com quem resolve.' },
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Simples, rápido e direto ao profissional.' },
];

const FooterLinkItem = ({ item }: { item: any }) => {
  const isExternal = item.open_in_new_tab || item.url?.startsWith('http');

  if (isExternal) {
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="story-link inline-flex items-center gap-1.5 transition-colors hover:text-primary-foreground">
        {item.label}
      </a>
    );
  }

  return (
    <Link to={item.url} className="story-link transition-colors hover:text-primary-foreground">
      {item.label}
    </Link>
  );
};

const Footer = () => {
  useSettingValue('logo_footer_url');
  const tagline = useMemo(() => footerTaglines[Math.floor(Math.random() * footerTaglines.length)], []);
  const blogEnabled = useFeatureEnabled('module_blog');

  const { data: menuGroups } = useMenuItemsByLocations(['footer', 'footer_eco']);

  const blogFilter = (items: any[]) => blogEnabled ? items : items.filter((l: any) => !(l.url || '').includes('/blog'));
  const profLinks = blogFilter(menuGroups?.footer?.length ? menuGroups.footer : fallbackProfissionaisAll);
  const ecoLinks = menuGroups?.footer_eco?.length ? menuGroups.footer_eco : fallbackEco;
  const suporteLinks = fallbackSuporte;

  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="container py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/">
              <Logo linkTo="" height="h-10 min-h-10 max-h-10" className="mb-4 brightness-0 invert" />
            </Link>
            <p className="text-sm font-semibold text-primary-foreground/90 mb-1">{tagline.headline}</p>
            <p className="text-sm leading-relaxed text-primary-foreground/70">
              {tagline.sub}
            </p>
          </div>

          {/* Profissionais */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Profissionais</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              {profLinks.map((item: any) => (
                <li key={item.id || item.url}>
                  <FooterLinkItem item={item} />
                </li>
              ))}
            </ul>
          </div>

          {/* Ecossistema */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Ecossistema</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              {ecoLinks.map((item: any) => (
                <li key={item.id || item.url}>
                  <FooterLinkItem item={item} />
                </li>
              ))}
            </ul>
          </div>

          {/* Suporte */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Suporte</h4>
            <ul className="space-y-3 text-sm text-primary-foreground/70">
              {suporteLinks.map((item: any) => (
                <li key={item.id || item.url}>
                  <Link
                    to={item.url}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-foreground/10 px-3 py-2 transition-colors hover:bg-primary-foreground/20"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Suspense fallback={null}>
          <PwaFooterInstall />
        </Suspense>

        <Suspense fallback={null}>
          <SponsorAd position="footer" layout="inline" className="mt-6 border-t border-primary-foreground/10 pt-6" />
        </Suspense>

        <div className="mt-6 border-t border-primary-foreground/10 pt-6">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-primary-foreground/50 mb-4">
            <Link to="/privacidade" className="hover:text-primary-foreground/80 transition-colors">Política de Privacidade</Link>
            <span>•</span>
            <Link to="/termos" className="hover:text-primary-foreground/80 transition-colors">Termos de Uso</Link>
            <span>•</span>
            <Link to="/cookies" className="hover:text-primary-foreground/80 transition-colors">Política de Cookies</Link>
          </div>
          <div className="text-center text-xs text-primary-foreground/40">
            <p>© 2026 Preciso de um. Todos os direitos reservados.</p>
            <p className="mt-1">CNPJ: 41.723.708/0001-58 — Ping Soluções · <a href="https://mestredosservicos.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-primary-foreground/70">mestredosservicos.com.br</a></p>
          </div>
        </div>

        <Suspense fallback={null}>
          <AdSlot slotSlug="global-footer" layout="inline" className="mt-6 border-t border-primary-foreground/10 pt-6" />
        </Suspense>
      </div>
    </footer>
  );
};

const AdSlot = lazy(() => importWithRetry(() => import('@/components/ads/AdSlot')));

export default Footer;

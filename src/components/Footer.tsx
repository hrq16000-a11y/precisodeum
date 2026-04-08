import { Link } from 'react-router-dom';
import { MessageCircle, Users } from 'lucide-react';
import { useMemo, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { useMenuItems } from '@/hooks/useMenuItems';

const DEFAULT_LOGO_URL = '/lovable-uploads/logo-transparent.png';
import SponsorAd from '@/components/SponsorAd';
import PwaFooterInstall from '@/components/PwaFooterInstall';

const ecosystemLinks = [
  { name: 'Mestre dos Serviços', url: 'https://mestredosservicos.com.br' },
  { name: 'Encontre um Técnico', url: 'https://www.encontreumtecnico.com' },
  { name: 'Preciso de um Técnico', url: 'https://www.precisodeumtecnico.com' },
  { name: 'Encontre um Profissional', url: 'https://www.encontreumprofissional.com.br' },
  { name: 'Preciso de um Profissional', url: 'https://www.precisodeumprofissional.com.br' },
  { name: 'TamoNaWeb', url: 'https://www.TamoNaWeb.com.br', isNew: true },
];

const footerTaglines = [
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Encontre serviços na sua cidade com contato direto e avaliações reais.' },
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Conectamos você a prestadores de serviços confiáveis perto de você.' },
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Compare, escolha e fale direto com profissionais da sua região.' },
  { headline: 'Os melhores profissionais estão aqui.', sub: 'Serviços verificados, contato rápido e profissionais próximos de você.' },
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

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const Footer = () => {
  const whatsappGroupUrl = useSettingValue('whatsapp_group_url');
  const logoFooterUrl = useSettingValue('logo_footer_url');
  const logoVertical = logoFooterUrl?.trim() ? logoFooterUrl.trim() : DEFAULT_LOGO_URL;
  const tagline = useMemo(() => footerTaglines[Math.floor(Math.random() * footerTaglines.length)], []);

  const { data: footerItems = [] } = useMenuItems('footer');

  const fallbackFooterLinks = [
    { label: 'Cadastro', url: '/cadastro' },
    { label: 'Login', url: '/login' },
    { label: 'Dashboard', url: '/dashboard' },
    { label: 'Buscar Profissionais', url: '/buscar' },
    { label: 'Vagas', url: '/vagas' },
    { label: 'Notícias', url: '/blog' },
    { label: 'Sobre', url: '/sobre' },
  ];

  const footerNavLinks = footerItems.length > 0 ? footerItems : fallbackFooterLinks;

  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <motion.div
        className="container py-12"
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
      >
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <motion.div variants={itemVariants} className="sm:col-span-2 lg:col-span-1">
            <Link to="/">
              <img src={logoVertical} alt="Preciso de um" className="mb-4 h-12 w-auto max-w-[220px] object-contain" width="133" height="48" />
            </Link>
            <p className="text-sm font-semibold text-primary-foreground/90 mb-1">{tagline.headline}</p>
            <p className="text-sm leading-relaxed text-primary-foreground/70">
              {tagline.sub}
            </p>
          </motion.div>

          {/* Dynamic Footer Nav */}
          <motion.div variants={itemVariants}>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Profissionais</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              {footerNavLinks.map((item: any) => (
                <li key={item.id || item.url}>
                  {item.open_in_new_tab || item.url?.startsWith('http') ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="story-link transition-colors hover:text-primary-foreground">
                      {item.icon && <span className="mr-1">{item.icon}</span>}
                      {item.label}
                    </a>
                  ) : (
                    <Link to={item.url} className="story-link transition-colors hover:text-primary-foreground">
                      {item.icon && <span className="mr-1">{item.icon}</span>}
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Ecossistema */}
          <motion.div variants={itemVariants}>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Ecossistema</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              {ecosystemLinks.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="story-link inline-flex items-center gap-1.5 transition-colors hover:text-primary-foreground">
                    {link.name}
                    {(link as any).isNew && (
                      <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[8px] font-bold uppercase text-accent">Novo</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Suporte */}
          <motion.div variants={itemVariants}>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Suporte</h4>
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
          </motion.div>
        </div>

        <PwaFooterInstall />

        <SponsorAd position="footer" layout="inline" className="mt-6 border-t border-primary-foreground/10 pt-6" />

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
      </motion.div>
    </footer>
  );
};

const AdSlot = lazy(() => import('@/components/ads/AdSlot'));

export default Footer;

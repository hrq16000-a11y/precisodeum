import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Megaphone, Globe, Phone, Mail, ExternalLink, BadgeCheck } from 'lucide-react';
import { SeoMeta } from '@/components/SeoMeta';

const SponsorPublicPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [sponsor, setSponsor] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const seoTitle = sponsor ? `${sponsor.company_name || sponsor.title} — Patrocinador` : 'Patrocinador';
  const seoDescription = sponsor?.full_description || sponsor?.short_description || 'Patrocinador oficial da plataforma.';
  const seoCanonical = slug ? `/patrocinador/${slug}` : undefined;
  const seoImage = sponsor?.logo_url || sponsor?.image_url || undefined;

  useEffect(() => {
    if (!slug) return;
    (async () => {
      // LGPD/A1: anon não tem SELECT em cnpj/email/whatsapp/phone.
      // Lista explícita evita "permission denied for column ..." no select('*').
      const { data } = await supabase
        .from('sponsors')
        .select(
          'id, user_id, slug, title, company_name, short_description, full_description, ' +
          'logo_url, image_url, link_url, external_link, ' +
          'linked_city, linked_city_slug, linked_category, linked_category_slug, ' +
          'status, plan, plan_tier, tier, sponsor_type, badge_type, ' +
          'campaign_start, campaign_end, deleted_at, created_at'
        )
        .eq('slug', slug)
        .is('deleted_at', null)
        .maybeSingle();
      setSponsor(data);
      setLoading(false);
    })();
  }, [slug]);

  const name = sponsor?.company_name || sponsor?.title;
  const desc = sponsor?.full_description || sponsor?.short_description;
  // LGPD/A1: e-mail, WhatsApp e telefone NÃO são expostos a visitantes anônimos.
  // O contato acontece via site externo (external_link / link_url).

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8">
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : !sponsor ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <h1 className="font-display text-xl font-bold text-foreground">Patrocinador não encontrado</h1>
            <p className="mt-2 text-sm text-muted-foreground">Este perfil não está disponível.</p>
          </div>
        ) : (
          <>
            <header className="rounded-2xl border border-border bg-card p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10 overflow-hidden">
                  {sponsor.logo_url ? (
                    <img src={sponsor.logo_url} alt={name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : sponsor.image_url ? (
                    <img src={sponsor.image_url} alt={name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <Megaphone className="h-10 w-10 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-display text-2xl font-bold text-foreground">{name}</h1>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                      <BadgeCheck className="h-3 w-3" /> Patrocinador
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {/* LGPD/A1: email/whatsapp/phone bloqueados para anon. Contato via site. */}
                    {(sponsor.external_link || sponsor.link_url) && (
                      <a href={sponsor.external_link || sponsor.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                        <Globe className="h-3.5 w-3.5" />Site
                      </a>
                    )}
                  </div>
                </div>
              </div>
              {desc && <p className="mt-4 text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{desc}</p>}
              {(sponsor.external_link || sponsor.link_url) && (
                <a
                  href={sponsor.external_link || sponsor.link_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Visitar site oficial <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </header>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default SponsorPublicPage;

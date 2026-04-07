import { Link } from 'react-router-dom';
import { ArrowRight, Crown, Star, MapPin, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { DbProvider } from '@/hooks/useProviders';
import { whatsappLink } from '@/lib/whatsapp';
import FadeInSection from '@/components/FadeInSection';
import { useCardImpression } from '@/hooks/useCardImpression';
import { trackWhatsAppClick, trackProfileClick } from '@/lib/tracking';
import AdNativeCard from '@/components/ads/AdNativeCard';

interface Props {
  providers: DbProvider[];
  isLoading: boolean;
}

const AD_INTERVAL = 4; // Insert a native ad every N cards

const FeaturedProviders = ({ providers, isLoading }: Props) => {
  // Build items list interleaving native ads
  const items: ({ type: 'provider'; data: DbProvider; index: number } | { type: 'ad'; adIndex: number })[] = [];
  let adCounter = 0;
  providers.forEach((p, i) => {
    items.push({ type: 'provider', data: p, index: i });
    if ((i + 1) % AD_INTERVAL === 0 && i < providers.length - 1) {
      items.push({ type: 'ad', adIndex: adCounter++ });
    }
  });

  return (
    <section className="bg-muted/50 py-12">
      <div className="container">
        <FadeInSection className="mb-8 flex items-end justify-between">
          <div>
            <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent mb-2">
              ⭐ Destaque
            </span>
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
              Profissionais em Destaque
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Os mais bem avaliados da plataforma</p>
          </div>
          <Button variant="ghost" size="sm" className="hidden text-primary md:flex" asChild>
            <Link to="/buscar">Ver todos <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </FadeInSection>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : providers.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Nenhum profissional em destaque ainda.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, idx) => {
              if (item.type === 'ad') {
                return (
                  <FadeInSection key={`ad-${item.adIndex}`} delay={idx * 0.05}>
                    <AdNativeCard sponsorIndex={item.adIndex} className="h-full" />
                  </FadeInSection>
                );
              }
              return (
                <FadeInSection key={item.data.id} delay={idx * 0.05}>
                  <ProviderCardFeatured provider={item.data} />
                </FadeInSection>
              );
            })}
          </div>
        )}

        <FadeInSection delay={0.3} className="mt-6 text-center md:hidden">
          <Button variant="outline" className="rounded-full" asChild>
            <Link to="/buscar">Ver todos os profissionais</Link>
          </Button>
        </FadeInSection>
      </div>
    </section>
  );
};

/** Inline featured card with tracking */
function ProviderCardFeatured({ provider: p }: { provider: DbProvider }) {
  const impressionRef = useCardImpression(p.id, p.slug, 'featured');
  const displayName = p.name || p.businessName || p.category || 'Profissional';
  const displayPhoto = p.photo || p.serviceImage || '';
  const rating = p.rating ?? 0;
  const reviewCount = p.reviewCount ?? 0;

  return (
    <div
      ref={impressionRef}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 h-full"
    >
      <div className="h-1 bg-gradient-to-r from-accent via-secondary to-accent" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex gap-4">
          <Avatar className="h-14 w-14 shrink-0 ring-2 ring-accent/20">
            <AvatarImage src={displayPhoto || undefined} alt={displayName} />
            <AvatarFallback className="bg-primary/10 text-2xl">
              {p.categoryIcon || '🔧'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <Link
              to={`/profissional/${p.slug}`}
              className="block"
              onClick={() => trackProfileClick(p.id, p.slug, 'featured')}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate font-display text-base font-bold text-foreground group-hover:text-primary transition-colors">
                  {displayName}
                </h3>
                <Crown className="mt-0.5 h-4 w-4 shrink-0 text-accent animate-pulse" aria-label="Destaque" />
              </div>
            </Link>
            {p.category && (
              <p className="mt-0.5 text-sm font-medium text-accent">{p.category}</p>
            )}
            {(p.city || p.state) && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {[p.city, p.state].filter(Boolean).join(' - ')}
              </div>
            )}
          </div>
        </div>

        {(rating > 0 || reviewCount > 0) ? (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(star => (
                <Star
                  key={star}
                  className={`h-3.5 w-3.5 ${star <= Math.round(rating) ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`}
                />
              ))}
            </div>
            <span className="text-xs font-semibold text-foreground">{rating > 0 ? rating.toFixed(1) : '—'}</span>
            {reviewCount > 0 && (
              <span className="text-[11px] text-muted-foreground">({reviewCount} {reviewCount === 1 ? 'avaliação' : 'avaliações'})</span>
            )}
          </div>
        ) : null}

        {p.yearsExperience > 0 ? (
          <Badge variant="secondary" className="mt-2 w-fit text-[10px]">
            {p.yearsExperience}+ anos de experiência
          </Badge>
        ) : null}

        <div className="flex-1" />

        <div className="mt-4 flex gap-2">
          {p.whatsapp && (
            <Button variant="accent" size="sm" className="flex-1" asChild>
              <a
                href={whatsappLink(p.whatsapp, `Olá! Vi seu perfil "${displayName}" no Preciso de um e gostaria de mais informações.`)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick(p.id, p.slug, 'featured')}
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" className={p.whatsapp ? '' : 'flex-1'} asChild>
            <Link
              to={`/profissional/${p.slug}`}
              onClick={() => trackProfileClick(p.id, p.slug, 'featured')}
            >
              Ver Perfil
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default FeaturedProviders;

import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Crown, Star, MapPin, MessageCircle, Sparkles, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import ProfileBadge from '@/components/ProfileBadge';
import { getRankTier } from '@/components/ReviewSummary';
import type { DbProvider } from '@/hooks/useProviders';
import { whatsappLink, buildSmartMessage } from '@/lib/whatsapp';
import { useGeoCity } from '@/hooks/useGeoCity';
import ProviderCardSkeleton from '@/components/ProviderCardSkeleton';
import { capitalizeName } from '@/lib/normalize';
import { useCardImpression } from '@/hooks/useCardImpression';
import { trackWhatsAppClick, trackProfileClick } from '@/lib/tracking';
import AdNativeCard from '@/components/ads/AdNativeCard';
import { useSettingValue } from '@/hooks/useSiteSettings';

interface Props {
  providers: DbProvider[];
  isLoading: boolean;
}

const AD_INTERVAL = 4;

const FeaturedProviders = ({ providers, isLoading }: Props) => {
  const items: ({ type: 'provider'; data: DbProvider; index: number } | { type: 'ad'; adIndex: number })[] = [];
  let adCounter = 0;
  providers.forEach((p, i) => {
    items.push({ type: 'provider', data: p, index: i });
    if ((i + 1) % AD_INTERVAL === 0 && i < providers.length - 1) {
      items.push({ type: 'ad', adIndex: adCounter++ });
    }
  });

  return (
    <section className="relative overflow-hidden pt-8 pb-24 md:py-14">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/50 via-background to-muted/50" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      
      <div className="container relative">
        <div className="mb-8 flex flex-col items-center text-center md:flex-row md:items-end md:justify-between md:text-left animate-fade-in">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent mb-3">
              <Sparkles className="h-3 w-3" /> Destaque
            </span>
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
              Profissionais em Destaque
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Os mais bem avaliados da plataforma</p>
          </div>
          <Button variant="ghost" size="sm" className="hidden text-accent md:flex mt-4 md:mt-0" asChild>
            <Link to="/buscar">Ver todos <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ProviderCardSkeleton count={6} />
          </div>
        ) : providers.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Nenhum profissional em destaque ainda.</p>
        ) : (
          <div className="grid justify-items-center gap-3 sm:gap-4 sm:grid-cols-2 sm:justify-items-stretch lg:grid-cols-3 [content-visibility:auto] [contain-intrinsic-size:1px_800px]">
            {items.map((item, idx) => {
              if (item.type === 'ad') {
                return (
                  <div key={`ad-${item.adIndex}`} className="w-full max-w-[90%] animate-fade-in sm:max-w-none" style={{ animationDelay: `${idx * 60}ms`, animationFillMode: 'both' }}>
                    <AdNativeCard sponsorIndex={item.adIndex} className="h-full" />
                  </div>
                );
              }
              return (
                <div key={item.data.id} className="w-full max-w-[90%] animate-fade-in sm:max-w-none" style={{ animationDelay: `${idx * 60}ms`, animationFillMode: 'both' }}>
                  <ProviderCardFeatured provider={item.data} />
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center md:hidden animate-fade-in" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          <Button variant="outline" className="rounded-full" asChild>
            <Link to="/buscar">Ver todos os profissionais</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

const ProviderCardFeatured = memo(function ProviderCardFeatured({ provider: p }: { provider: DbProvider }) {
  const impressionRef = useCardImpression(p.id, p.slug, 'featured');
  const avatarFallbackStyle = useSettingValue('avatar_fallback_style') || 'adventurer';
  const { city: geoCity, state: geoState } = useGeoCity();
  const displayName = capitalizeName(p.name || p.businessName || p.category || 'Profissional');
  const hasOwnPhoto = !!(p.photo || p.serviceImage);
  const generatedAvatar = `https://api.dicebear.com/9.x/${avatarFallbackStyle}/svg?seed=${encodeURIComponent(p.userId || p.id)}`;
  const displayPhoto = p.photo || p.serviceImage || generatedAvatar;
  const rating = p.rating ?? 0;
  const reviewCount = p.reviewCount ?? 0;

  const isDestaque = p.plan === 'premium' && (
    hasOwnPhoto ||
    (p.servicesCount || 0) >= 1 ||
    (p.portfolioAlbumCount || 0) > 0 ||
    !!(p as any).description
  );

  return (
    <div
      ref={impressionRef}
      className="group relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      {/* Shine sweep */}
      <div className="card-shine-sweep pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent" style={{ left: '-100%', width: '50%' }} />
      {/* Premium accent bar */}
      <div className="h-1 shrink-0 bg-gradient-to-r from-accent via-amber-400 to-accent" />

      {/* Crown badge — absolute, never displaces name */}
      {isDestaque && (
        <div className="absolute right-2 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md">
          <Crown className="h-3 w-3" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
          <Avatar className="h-12 w-12 shrink-0 ring-2 ring-accent/20 transition-transform duration-300 group-hover:scale-105 sm:h-16 sm:w-16">
            <AvatarImage src={displayPhoto || undefined} alt={displayName} className="object-cover" />
            <AvatarFallback className="bg-accent/10 text-2xl">
              {p.categoryIcon || '🔧'}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <Link
              to={`/profissional/${p.slug}`}
              className="block min-w-0"
              onClick={() => trackProfileClick(p.id, p.slug, 'featured')}
            >
              <h3
                className="font-display text-[15px] font-bold text-foreground transition-colors group-hover:text-accent sm:text-base"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                }}
              >
                {displayName}
              </h3>
            </Link>
             <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <ProfileBadge hasPhoto={hasOwnPhoto} hasServices={(p.servicesCount || 0) >= 1} size="sm" />
              {(() => {
                const tier = getRankTier(rating, reviewCount);
                return tier ? (
                  <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${tier.bg} ${tier.color} border ${tier.border}`}>
                    <Trophy className="h-2.5 w-2.5" /> {tier.label}
                  </span>
                ) : null;
              })()}
            </div>
            {p.category && (
               <p className="truncate text-[13px] font-medium text-accent sm:text-sm">{p.category}</p>
            )}
            {(p.city || p.state) && (
               <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground sm:text-xs">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{[p.city, p.state].filter(Boolean).join(' - ')}</span>
              </div>
            )}
          </div>
        </div>

        {(rating > 0 || reviewCount > 0) && (
           <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(star => (
                <Star
                  key={star}
                  className={`h-3.5 w-3.5 ${star <= Math.round(rating) ? 'fill-accent text-accent' : 'text-muted-foreground/20'}`}
                />
              ))}
            </div>
            <span className="text-xs font-bold text-foreground">{rating > 0 ? rating.toFixed(1) : '—'}</span>
            {reviewCount > 0 && (
              <span className="text-[11px] text-muted-foreground">({reviewCount})</span>
            )}
          </div>
        )}

        {p.yearsExperience > 0 && (
           <Badge variant="secondary" className="mt-1.5 w-fit max-w-full truncate text-[10px]">
            {p.yearsExperience}+ anos de experiência
          </Badge>
        )}

         {/* Buttons — flex-wrap allows stacking on extreme narrow screens */}
         <div className="mt-2.5 flex w-full min-w-0 flex-wrap items-stretch gap-2">
          {p.whatsapp && (
            <Button
              variant="accent"
              size="sm"
              className="h-9 min-w-0 flex-1 basis-[120px] px-2 text-xs transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] sm:h-10 sm:text-sm"
              asChild
            >
              <a
                href={whatsappLink(p.whatsapp, buildSmartMessage(displayName, p.category, geoCity, geoState))}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick(p.id, p.slug, 'featured')}
                className="inline-flex w-full min-w-0 items-center justify-center gap-1"
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <span className="truncate">WhatsApp</span>
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-9 min-w-0 flex-1 basis-[100px] px-2 text-xs transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] sm:h-10 sm:text-sm"
            asChild
          >
            <Link
              to={`/profissional/${p.slug}`}
              onClick={() => trackProfileClick(p.id, p.slug, 'featured')}
              className="inline-flex w-full min-w-0 items-center justify-center"
            >
              <span className="truncate">Ver Perfil</span>
            </Link>
          </Button>
        </div>
         <p className="mt-1 text-center text-[10px] text-muted-foreground">Orçamento sem compromisso</p>
      </div>
    </div>
  );
});

export default FeaturedProviders;

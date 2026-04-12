import { Link } from 'react-router-dom';
import { MapPin, Crown, Clock, Circle, ArrowRight, Trophy } from 'lucide-react';
import { usePrefetchProvider, usePrefetchHandlers } from '@/hooks/usePrefetch';
import { Button } from '@/components/ui/button';
import ProfileBadge from '@/components/ProfileBadge';
import CategoryIcon from '@/components/CategoryIcon';
import { getRankTier } from '@/components/ReviewSummary';
import StarRating from '@/components/StarRating';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { DbProvider } from '@/hooks/useProviders';
import { useFeatureEnabled, useSettingValue } from '@/hooks/useSiteSettings';
import { whatsappLink } from '@/lib/whatsapp';
import { useGeoCity } from '@/hooks/useGeoCity';
import { handleImageError } from '@/lib/imageResolver';
import { useCardImpression } from '@/hooks/useCardImpression';
import { trackWhatsAppClick, trackProfileClick } from '@/lib/tracking';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useIsProviderOnline } from '@/hooks/useOnlinePresence';

interface ProviderCardProps {
  provider: DbProvider;
  isFallback?: boolean;
  trackingSource?: string;
  index?: number;
}

const MAX_BADGES_MOBILE = 3;

const ProviderCard = ({ provider, isFallback = false, trackingSource = 'home', index = 0 }: ProviderCardProps) => {
  const reviewsEnabled = useFeatureEnabled('reviews_enabled');
  const verifiedEnabled = useFeatureEnabled('verified_badge_enabled');
  const minServices = Number(useSettingValue('verified_badge_min_services')) || 2;
  const minAlbums = Number(useSettingValue('verified_badge_min_albums')) || 1;
  const minReviews = Number(useSettingValue('verified_badge_min_reviews')) || 1;
  const minRating = Number(useSettingValue('verified_badge_min_rating')) || 0;
  const requirePhoto = useSettingValue('verified_badge_require_photo') !== 'false';
  const requireCnpj = useSettingValue('verified_badge_require_cnpj') !== 'false';
  const requireCity = useSettingValue('verified_badge_require_city') !== 'false';

  const destaqueRequireAvatar = useSettingValue('destaque_require_avatar') !== 'false';
  const destaqueRequirePortfolio = useSettingValue('destaque_require_portfolio') !== 'false';
  const destaqueRequireServices = useSettingValue('destaque_require_services') !== 'false';
  const destaqueMinServices = Number(useSettingValue('destaque_min_services')) || 1;
  const destaqueMinPortfolio = Number(useSettingValue('destaque_min_portfolio')) || 1;
  const avatarFallbackStyle = useSettingValue('avatar_fallback_style') || 'adventurer';

  const { user } = useAuth();
  const { city: geoCity, state: geoState } = useGeoCity();
  const isOnline = useIsProviderOnline(provider.userId);
  const prefetch = usePrefetchProvider();
  const handlers = usePrefetchHandlers(prefetch, provider.slug);
  const hasImages = !!provider.serviceImage || !!provider.hasPortfolio;
  const impressionRef = useCardImpression(provider.id, provider.slug, trackingSource);

  const hasLocation = !!(provider.city || provider.neighborhood);
  const locationParts = [provider.neighborhood, provider.city, provider.state].filter(Boolean);
  const locationText = locationParts.join(', ');

  const displayName = provider.name || provider.businessName || 'Profissional';
  const generatedAvatar = `https://api.dicebear.com/9.x/${avatarFallbackStyle}/svg?seed=${encodeURIComponent(provider.userId || provider.id)}`;
  const hasOwnPhoto = !!(provider.photo || provider.serviceImage);
  const displayPhoto = provider.photo || provider.serviceImage || generatedAvatar;

  const isVerified = verifiedEnabled && (
    provider.servicesCount >= minServices &&
    provider.portfolioAlbumCount >= minAlbums &&
    provider.reviewCount >= minReviews &&
    (minRating <= 0 || provider.rating >= minRating) &&
    (!requirePhoto || !!displayPhoto) &&
    (!requireCnpj || !!(provider as any).cnpj) &&
    (!requireCity || !!provider.city)
  );

  // Build badges array for mobile limiting
  const badges: React.ReactNode[] = [];
  badges.push(
    <ProfileBadge key="profile" hasPhoto={hasOwnPhoto} hasServices={(provider.servicesCount || 0) >= 1} size="sm" />
  );
  const tier = getRankTier(provider.rating, provider.reviewCount);
  if (tier) {
    badges.push(
      <span key="tier" className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${tier.bg} ${tier.color} border ${tier.border}`}>
        <Trophy className="h-2.5 w-2.5" /> {tier.label}
      </span>
    );
  }
  if (provider.distanceKm != null && provider.distanceKm < 2) {
    badges.push(
      <motion.span
        key="super-perto"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-accent/20 to-primary/20 px-2 py-0.5 text-[11px] font-bold text-accent border border-accent/30"
      >
        ⚡ Super Perto!
      </motion.span>
    );
  } else if (provider.distanceKm != null && provider.distanceKm < 5) {
    badges.push(
      <span key="rapido" className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
        ⚡ Atendimento Rápido
      </span>
    );
  }
  if ((provider as any).response_time) {
    badges.push(
      <span key="response" className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
        <Clock className="h-3 w-3" /> {(provider as any).response_time}
      </span>
    );
  }
  if (isFallback) {
    badges.push(
      <span key="fallback" className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
        <MapPin className="h-3 w-3" /> Outra região
      </span>
    );
  }
  if (isOnline) {
    badges.push(
      <span key="online" className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
        <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" /> Online
      </span>
    );
  }

  const visibleBadges = badges.slice(0, MAX_BADGES_MOBILE);
  const hiddenCount = badges.length - visibleBadges.length;

  return (
    <motion.div
      ref={impressionRef}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -4 }}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-card transition-shadow duration-300 hover:shadow-card-hover ${hasImages ? 'border-accent/50 ring-1 ring-accent/20' : 'border-border'}`}
      {...handlers}
    >
      {/* Hover gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/0 to-primary/0 group-hover:from-accent/5 group-hover:to-primary/5 transition-all duration-500 rounded-xl" />
      {/* Shine sweep */}
      <div className="card-shine-sweep pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent" style={{ left: '-100%', width: '50%' }} />

      <div className="flex flex-1 flex-col p-3 sm:p-[1.25rem] relative">
        <div className="flex gap-3 sm:gap-4">
           <Avatar className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 transition-transform duration-300 group-hover:scale-105 ring-2 ring-transparent group-hover:ring-accent/20">
            <AvatarImage src={displayPhoto || undefined} alt={displayName} loading="lazy" decoding="async" onError={handleImageError} />
            <AvatarFallback className="bg-primary/10">
              <CategoryIcon icon={provider.categoryIcon || ''} size={24} className="text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <Link
              to={`/profissional/${provider.slug}`}
              className="block"
              onClick={() => trackProfileClick(provider.id, provider.slug, trackingSource)}
              {...handlers}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 break-words font-display text-sm sm:text-base font-bold text-foreground group-hover:text-accent transition-colors">
                  {displayName}
                </h3>
                {provider.plan === 'premium' && (
                  hasOwnPhoto ||
                  provider.servicesCount >= (destaqueMinServices || 1) ||
                  (provider.portfolioAlbumCount || 0) > 0 ||
                  !!(provider as any).description
                ) && (
                  <motion.div animate={{ rotate: [0, 12, -12, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}>
                    <Crown className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-label="Destaque" />
                  </motion.div>
                )}
              </div>
            </Link>
            {provider.businessName && provider.businessName !== displayName && (
              <p className="line-clamp-1 break-words text-xs text-muted-foreground">{provider.businessName}</p>
            )}
            {provider.category && (
              <p className="mt-0.5 text-xs sm:text-sm font-medium text-accent">{provider.category}</p>
            )}
            {hasLocation && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{locationText}</span>
                {provider.distanceKm != null && (
                  <span className="ml-1 shrink-0 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    📍 {provider.distanceKm < 1 ? '< 1' : provider.distanceKm.toFixed(1)} km
                    <span className="opacity-70">· ~{provider.distanceKm < 2 ? '< 5' : Math.ceil(provider.distanceKm * 60 / 25)} min</span>
                  </span>
                )}
              </div>
            )}
            {/* Badges — limited on mobile */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1 sm:gap-1.5">
              {/* Show all on sm+, limited on mobile */}
              <span className="contents sm:hidden">
                {visibleBadges}
                {hiddenCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    +{hiddenCount}
                  </span>
                )}
              </span>
              <span className="hidden sm:contents">
                {badges}
              </span>
            </div>
          </div>
        </div>

        {reviewsEnabled && provider.reviewCount > 0 && (
          <div className="mt-2 sm:mt-3">
            <StarRating rating={provider.rating} count={provider.reviewCount} size={14} />
          </div>
        )}

        {provider.description && !/cadastrado na plataforma|entre em contato para mais informa/i.test(provider.description) && (
          <p className="mt-2 sm:mt-3 line-clamp-2 text-xs sm:text-sm text-muted-foreground">
            {provider.description}
          </p>
        )}

        <div className="flex-1" />

        <div className="mt-3 sm:mt-4 flex flex-wrap gap-2">
          {provider.whatsapp && (
            <Button variant="accent" size="sm" className="flex-1 h-8 sm:h-9 text-xs sm:text-sm transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]" asChild>
              <a
                href={whatsappLink(provider.whatsapp, `Olá ${displayName}! Vi seu perfil de ${provider.category || 'serviços'} no Preciso de um.${geoCity ? ` Estou em ${geoCity}${geoState ? `/${geoState}` : ''} e` : ' E'} gostaria de um orçamento.`)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick(provider.id, provider.slug, trackingSource)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 icon-cta icon-bounce" aria-hidden="true" style={{ color: '#25D366' }}>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" className={`h-8 sm:h-9 text-xs sm:text-sm transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] ${provider.whatsapp ? '' : 'flex-1'}`} asChild>
            <Link
              to={`/profissional/${provider.slug}`}
              onClick={() => trackProfileClick(provider.id, provider.slug, trackingSource)}
              {...handlers}
            >
              Ver Perfil <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <p className="mt-1 sm:mt-1.5 text-center text-[10px] text-muted-foreground">Orçamento sem compromisso</p>
      </div>
    </motion.div>
  );
};

export default ProviderCard;

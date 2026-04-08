import { Link } from 'react-router-dom';
import { MapPin, MessageCircle, Crown, BadgeCheck, Clock } from 'lucide-react';
import { usePrefetchProvider, usePrefetchHandlers } from '@/hooks/usePrefetch';
import { Button } from '@/components/ui/button';
import StarRating from '@/components/StarRating';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { DbProvider } from '@/hooks/useProviders';
import { useFeatureEnabled } from '@/hooks/useSiteSettings';
import { whatsappLink } from '@/lib/whatsapp';
import { handleImageError } from '@/lib/imageResolver';
import { useCardImpression } from '@/hooks/useCardImpression';
import { trackWhatsAppClick, trackProfileClick } from '@/lib/tracking';
import { motion } from 'framer-motion';

interface ProviderCardProps {
  provider: DbProvider;
  isFallback?: boolean;
  trackingSource?: string;
  index?: number;
}

const ProviderCard = ({ provider, isFallback = false, trackingSource = 'home', index = 0 }: ProviderCardProps) => {
  const reviewsEnabled = useFeatureEnabled('reviews_enabled');
  const prefetch = usePrefetchProvider();
  const handlers = usePrefetchHandlers(prefetch, provider.slug);
  const displayPhoto = provider.photo || provider.serviceImage || '';
  const hasImages = !!provider.serviceImage || !!provider.hasPortfolio;
  const impressionRef = useCardImpression(provider.id, provider.slug, trackingSource);

  const hasLocation = !!(provider.city || provider.neighborhood);
  const locationParts = [provider.neighborhood, provider.city, provider.state].filter(Boolean);
  const locationText = locationParts.join(', ');

  const displayName = provider.name || provider.businessName || 'Profissional';

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
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700 ease-out" />

      <div className="flex flex-1 flex-col p-5 relative">
        <div className="flex gap-4">
           <Avatar className="h-14 w-14 shrink-0 transition-transform duration-300 group-hover:scale-105 ring-2 ring-transparent group-hover:ring-accent/20">
            <AvatarImage src={displayPhoto || undefined} alt={displayName} loading="lazy" decoding="async" onError={handleImageError} />
            <AvatarFallback className="bg-primary/10 text-2xl">
              {provider.categoryIcon || '🔧'}
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
                <h3 className="truncate font-display text-base font-bold text-foreground group-hover:text-accent transition-colors">
                  {displayName}
                </h3>
                {provider.plan === 'premium' && (
                  <motion.div animate={{ rotate: [0, 12, -12, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}>
                    <Crown className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-label="Destaque" />
                  </motion.div>
                )}
              </div>
            </Link>
            {provider.businessName && provider.businessName !== displayName && (
              <p className="truncate text-xs text-muted-foreground">{provider.businessName}</p>
            )}
            {provider.category && (
              <p className="mt-0.5 text-sm font-medium text-accent">{provider.category}</p>
            )}
            {hasLocation && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {locationText}
              </div>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {hasImages && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                  <BadgeCheck className="h-3 w-3" /> Perfil Completo
                </span>
              )}
              {provider.responseTime && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                  <Clock className="h-3 w-3" /> {provider.responseTime}
                </span>
              )}
              {isFallback && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  <MapPin className="h-3 w-3" /> Atende sua região
                </span>
              )}
            </div>
          </div>
        </div>

        {reviewsEnabled && provider.reviewCount > 0 && (
          <div className="mt-3">
            <StarRating rating={provider.rating} count={provider.reviewCount} size={14} />
          </div>
        )}

        {provider.description && (
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
            {provider.description}
          </p>
        )}

        <div className="flex-1" />

        <div className="mt-4 flex gap-2">
          {provider.whatsapp && (
            <Button variant="accent" size="sm" className="flex-1 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]" asChild>
              <a
                href={whatsappLink(provider.whatsapp, `Olá! Vi seu perfil "${displayName}" no Preciso de um e gostaria de mais informações.`)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick(provider.id, provider.slug, trackingSource)}
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" className={`transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] ${provider.whatsapp ? '' : 'flex-1'}`} asChild>
            <Link
              to={`/profissional/${provider.slug}`}
              onClick={() => trackProfileClick(provider.id, provider.slug, trackingSource)}
              {...handlers}
            >
              Ver Perfil
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProviderCard;

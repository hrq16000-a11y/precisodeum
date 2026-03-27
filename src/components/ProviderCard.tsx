import { Link } from 'react-router-dom';
import { MapPin, MessageCircle, Crown, BadgeCheck } from 'lucide-react';
import { usePrefetchProvider, usePrefetchHandlers } from '@/hooks/usePrefetch';
import { Button } from '@/components/ui/button';
import StarRating from '@/components/StarRating';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { DbProvider } from '@/hooks/useProviders';
import { useFeatureEnabled } from '@/hooks/useSiteSettings';
import { whatsappLink } from '@/lib/whatsapp';

interface ProviderCardProps {
  provider: DbProvider;
  isFallback?: boolean;
}

const ProviderCard = ({ provider, isFallback = false }: ProviderCardProps) => {
  const reviewsEnabled = useFeatureEnabled('reviews_enabled');
  const prefetch = usePrefetchProvider();
  const handlers = usePrefetchHandlers(prefetch, provider.slug);
  const displayPhoto = provider.photo || provider.serviceImage || '';
  const hasImages = !!provider.serviceImage || !!provider.hasPortfolio;

  const hasLocation = !!(provider.city || provider.neighborhood);
  const locationParts = [provider.neighborhood, provider.city, provider.state].filter(Boolean);
  const locationText = locationParts.join(', ');

  // Safe display name - never show empty
  const displayName = provider.name || provider.businessName || 'Profissional';

  return (
    <div className={`group flex flex-col overflow-hidden rounded-xl border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 ${hasImages ? 'border-accent/50 ring-1 ring-accent/20' : 'border-border'}`} {...handlers}>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex gap-4">
           <Avatar className="h-14 w-14 shrink-0">
            <AvatarImage src={displayPhoto || undefined} alt={displayName} loading="lazy" decoding="async" />
            <AvatarFallback className="bg-primary/10 text-2xl">
              {provider.categoryIcon || '🔧'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <Link to={`/profissional/${provider.slug}`} className="block" {...handlers}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate font-display text-base font-bold text-foreground group-hover:text-accent transition-colors">
                  {displayName}
                </h3>
                {provider.plan === 'premium' && <Crown className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-label="Destaque" />}
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
            {hasImages && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                <BadgeCheck className="h-3 w-3" /> Perfil Completo
              </span>
            )}
            {isFallback && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                <MapPin className="h-3 w-3" /> Atende sua região
              </span>
            )}
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

        {/* Spacer to push CTAs to bottom for consistent card height */}
        <div className="flex-1" />

        <div className="mt-4 flex gap-2">
          {provider.whatsapp && (
            <Button variant="accent" size="sm" className="flex-1" asChild>
              <a href={whatsappLink(provider.whatsapp, `Olá! Vi seu perfil "${displayName}" no Preciso de um e gostaria de mais informações.`)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" className={provider.whatsapp ? '' : 'flex-1'} asChild>
            <Link to={`/profissional/${provider.slug}`} {...handlers}>Ver Perfil</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProviderCard;

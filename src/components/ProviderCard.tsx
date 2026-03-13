import { Link } from 'react-router-dom';
import { MapPin, MessageCircle, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StarRating from '@/components/StarRating';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { DbProvider } from '@/hooks/useProviders';

interface ProviderCardProps {
  provider: DbProvider;
}

const ProviderCard = ({ provider }: ProviderCardProps) => {
  const initials = provider.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
        <Crown className="h-3 w-3" /> Destaque
      </div>
      <div className="p-5">
        <div className="flex gap-4">
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarImage src={provider.photo || undefined} alt={provider.name} />
            <AvatarFallback className="bg-primary text-lg font-bold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <Link to={`/profissional/${provider.slug}`}>
              <h3 className="truncate font-display text-base font-bold text-foreground group-hover:text-accent transition-colors">
                {provider.name}
              </h3>
            </Link>
            {provider.businessName && (
              <p className="truncate text-xs text-muted-foreground">{provider.businessName}</p>
            )}
            <p className="mt-0.5 text-sm font-medium text-accent">{provider.category}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {provider.neighborhood}, {provider.city} - {provider.state}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <StarRating rating={provider.rating} count={provider.reviewCount} size={14} />
        </div>

        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
          {provider.description}
        </p>

        <div className="mt-4 flex gap-2">
          <Button variant="accent" size="sm" className="flex-1" asChild>
            <a href={`https://wa.me/${provider.whatsapp}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/profissional/${provider.slug}`}>Ver Perfil</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProviderCard;

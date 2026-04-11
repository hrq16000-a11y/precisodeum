import { Link } from 'react-router-dom';
import { ArrowRight, Crown, Star, MapPin, MessageCircle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { DbProvider } from '@/hooks/useProviders';
import { whatsappLink } from '@/lib/whatsapp';
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

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 28, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

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
    <section className="relative py-14 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/50 via-background to-muted/50" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      
      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col items-center text-center md:flex-row md:items-end md:justify-between md:text-left"
        >
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
        </motion.div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : providers.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Nenhum profissional em destaque ainda.</p>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="visible"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((item, idx) => {
              if (item.type === 'ad') {
                return (
                  <motion.div key={`ad-${item.adIndex}`} variants={cardVariant}>
                    <AdNativeCard sponsorIndex={item.adIndex} className="h-full" />
                  </motion.div>
                );
              }
              return (
                <motion.div key={item.data.id} variants={cardVariant}>
                  <ProviderCardFeatured provider={item.data} />
                </motion.div>
              );
            })}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center md:hidden"
        >
          <Button variant="outline" className="rounded-full" asChild>
            <Link to="/buscar">Ver todos os profissionais</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

function ProviderCardFeatured({ provider: p }: { provider: DbProvider }) {
  const impressionRef = useCardImpression(p.id, p.slug, 'featured');
  const avatarFallbackStyle = useSettingValue('avatar_fallback_style') || 'adventurer';
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
    <motion.div
      ref={impressionRef}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.25 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow duration-300 hover:shadow-xl h-full"
    >
      {/* Shine sweep */}
      <div className="card-shine-sweep pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent" style={{ left: '-100%', width: '50%' }} />
      {/* Premium accent bar */}
      <div className="h-1 bg-gradient-to-r from-accent via-amber-400 to-accent" />
      
      <div className="flex flex-1 flex-col p-5">
        <div className="flex gap-4">
          <div className="relative">
            <Avatar className="h-16 w-16 shrink-0 ring-2 ring-accent/20 transition-transform duration-300 group-hover:scale-105">
              <AvatarImage src={displayPhoto || undefined} alt={displayName} />
              <AvatarFallback className="bg-accent/10 text-2xl">
                {p.categoryIcon || '🔧'}
              </AvatarFallback>
            </Avatar>
            {isDestaque && (
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
              className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md"
            >
              <Crown className="h-3 w-3" />
            </motion.div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <Link
              to={`/profissional/${p.slug}`}
              className="block"
              onClick={() => trackProfileClick(p.id, p.slug, 'featured')}
            >
              <h3 className="truncate font-display text-base font-bold text-foreground group-hover:text-accent transition-colors">
                {displayName}
              </h3>
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

        {(rating > 0 || reviewCount > 0) && (
          <div className="mt-3 flex items-center gap-2">
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
          <Badge variant="secondary" className="mt-2 w-fit text-[10px]">
            {p.yearsExperience}+ anos de experiência
          </Badge>
        )}

        <div className="flex-1" />

        <div className="mt-4 flex gap-2">
          {p.whatsapp && (
            <Button variant="accent" size="sm" className="flex-1 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]" asChild>
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
          <Button variant="outline" size="sm" className={`transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] ${p.whatsapp ? '' : 'flex-1'}`} asChild>
            <Link
              to={`/profissional/${p.slug}`}
              onClick={() => trackProfileClick(p.id, p.slug, 'featured')}
            >
              Ver Perfil
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default FeaturedProviders;

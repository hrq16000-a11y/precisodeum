import { memo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Crown, Clock, Circle, ArrowRight, Trophy, Sparkles, Zap, Rocket } from 'lucide-react';
import { usePrefetchProvider, usePrefetchHandlers } from '@/hooks/usePrefetch';
import { Button } from '@/components/ui/button';
import ProfileBadge from '@/components/ProfileBadge';
import CategoryIcon from '@/components/CategoryIcon';
import { getRankTier } from '@/components/ReviewSummary';
import StarRating from '@/components/StarRating';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { DbProvider } from '@/hooks/useProviders';
import { useFeatureEnabled, useSettingValue } from '@/hooks/useSiteSettings';
import { whatsappLink, buildSmartMessage } from '@/lib/whatsapp';
import { useGeoCity } from '@/hooks/useGeoCity';
import { handleImageError, getOptimizedUrl } from '@/lib/imageResolver';
import { responsiveImageSrcSet } from '@/lib/imageOptimizer';
import { useCardImpression } from '@/hooks/useCardImpression';
import { trackWhatsAppClick, trackProfileClick } from '@/lib/tracking';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useIsProviderOnline } from '@/hooks/useOnlinePresence';
import { OnlineBadge } from '@/components/OnlineBadge';
import ActivitySignalBadge from '@/components/ActivitySignalBadge';
import { useProviderActivity } from '@/hooks/useProviderActivity';
import { useEngagementPoints } from '@/hooks/useEngagementPoints';
import { getEngagementTier } from '@/lib/engagementTiers';
import CommunityVerifiedBadge from '@/components/CommunityVerifiedBadge';
import TopProfessionalBadge from '@/components/TopProfessionalBadge';
import { useTopProfessional } from '@/hooks/useTopProfessional';
import FavoriteButton from '@/components/FavoriteButton';
import {
  resolveDisplayName,
  resolveAvatarUrl,
  hasRealAvatar as hasRealAvatarFn,
  isDuplicateCategoryLabel,
  normalizeProviderToken,
} from '@/lib/providerDisplay';

interface ProviderCardProps {
  provider: DbProvider;
  isFallback?: boolean;
  trackingSource?: string;
  index?: number;
}

const MAX_BADGES_MOBILE = 3;

const ProviderCard = ({ provider, isFallback = false, trackingSource = 'home', index = 0 }: ProviderCardProps) => {
  const reviewsEnabled = useFeatureEnabled('reviews_enabled');

  const destaqueRequireAvatar = useSettingValue('destaque_require_avatar') !== 'false';
  const destaqueRequirePortfolio = useSettingValue('destaque_require_portfolio') !== 'false';
  const destaqueRequireServices = useSettingValue('destaque_require_services') !== 'false';
  const destaqueMinServices = Number(useSettingValue('destaque_min_services')) || 1;
  const destaqueMinPortfolio = Number(useSettingValue('destaque_min_portfolio')) || 1;
  const avatarFallbackStyle = useSettingValue('avatar_fallback_style') || 'adventurer';

  const { user } = useAuth();
  const { city: geoCity, state: geoState } = useGeoCity();
  const isOnline = useIsProviderOnline(provider.userId);
  const { data: activity } = useProviderActivity(provider.userId);
  const workingNow = !!activity?.working_now;
  const activeToday = !!activity?.active_today;
  const isTopProfessional = useTopProfessional(provider.userId);
  const { data: engagementPoints = 0 } = useEngagementPoints(provider.userId);
  const engTier = getEngagementTier(engagementPoints);
  const prefetch = usePrefetchProvider();
  const handlers = usePrefetchHandlers(prefetch, provider.slug);
  const hasImages = !!provider.serviceImage || !!provider.hasPortfolio;
  const impressionRef = useCardImpression(provider.id, provider.slug, trackingSource);

  const hasLocation = !!(provider.city || provider.neighborhood);
  const locationParts = [provider.neighborhood, provider.city, provider.state].filter(Boolean);
  const locationText = locationParts.join(', ');

  // Centralized name + avatar resolution (single source of truth across feeds)
  const displayName = resolveDisplayName({
    providerName: provider.name,
    businessName: provider.businessName,
    slug: provider.slug,
    city: provider.city,
  });
  const hasOwnPhoto = hasRealAvatarFn({
    providerPhotoUrl: provider.photo,
    serviceImage: provider.serviceImage,
  });
  const displayPhoto = resolveAvatarUrl({
    providerPhotoUrl: provider.photo,
    serviceImage: provider.serviceImage,
    seed: provider.userId || provider.id,
    fallbackStyle: avatarFallbackStyle,
  });

  // Hide repeated subtitles (avoid showing "Pedreiro" both as name + category).
  const nameNorm = normalizeProviderToken(displayName);
  const businessNorm = provider.businessName ? normalizeProviderToken(provider.businessName) : '';
  const categoryDuplicatesName = isDuplicateCategoryLabel(displayName, provider.category, provider.businessName);
  const altSubtitle = categoryDuplicatesName
    ? (provider.city ? `Atende em ${provider.city}` : 'Profissional verificado')
    : null;

  // Build badges array for mobile limiting
  const badges: React.ReactNode[] = [];
  badges.push(
    <ProfileBadge key="profile" hasPhoto={hasOwnPhoto} hasServices={(provider.servicesCount || 0) >= 1} size="sm" />
  );
  if (engTier.tier !== 'bronze') {
    badges.push(
      <span key="eng-tier" className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${engTier.badgeClass}`}>
        {engTier.label}
      </span>
    );
  }
  const tier = getRankTier(provider.rating, provider.reviewCount);
  if (tier) {
    badges.push(
      <span key="tier" className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${tier.bg} ${tier.color} border ${tier.border}`}>
        <Trophy className="h-2.5 w-2.5" /> {tier.label}
      </span>
    );
  }
  const suspiciousDistance = !!provider._distanceAudit?.suspicious;
  const rawDistanceKm = provider._distanceAudit?.distanceKm ?? provider.distanceKm;
  // Guard contra Infinity/NaN: distância só vale se for número finito > 0.
  const trustedDistanceKm = (typeof rawDistanceKm === 'number' && Number.isFinite(rawDistanceKm) && rawDistanceKm >= 0)
    ? rawDistanceKm
    : null;
  // Telemetria one-shot por card: registra quando recebemos coords inválidas.
  const distanceMissingReportedRef = useRef(false);
  useEffect(() => {
    if (distanceMissingReportedRef.current) return;
    const hasAuditOrField = provider._distanceAudit !== undefined || provider.distanceKm !== undefined;
    if (!hasAuditOrField) return; // contexto sem GPS nem audit — não conta como erro
    if (trustedDistanceKm !== null) return;
    distanceMissingReportedRef.current = true;
    // Importa lazy para não custar bundle no caminho feliz
    import('@/lib/tracking').then(({ trackGeoEvent }) => {
      trackGeoEvent('geo_failed', {
        stage: 'provider_card_distance_missing',
        provider_id: String(provider.id),
        provider_city: String(provider.city || ''),
        audit_source: String(provider._distanceAudit?.source || 'none'),
        raw_value: String(rawDistanceKm ?? 'undefined'),
      });
    }).catch(() => {});
  }, [provider.id, provider.city, provider._distanceAudit, provider.distanceKm, rawDistanceKm, trustedDistanceKm]);

  if (!suspiciousDistance && trustedDistanceKm != null && trustedDistanceKm < 2) {
    badges.push(
      <motion.span
        key="super-perto"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-accent/20 to-primary/20 px-2 py-0.5 text-[11px] font-bold text-accent border border-accent/30"
      >
        Super Perto!
      </motion.span>
    );
  }
  // Nota: o destaque "Atende agora no seu bairro" (<5km) é renderizado abaixo no header,
  // com animação pulse — mais informativo. Evitamos duplicar o badge aqui.
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
  // Trial boost — "Novo Profissional em Destaque" (7 dias após completar checklist)
  const trialBoostActive = !!provider.trialBoostUntil && new Date(provider.trialBoostUntil).getTime() > Date.now();
  if (trialBoostActive) {
    badges.push(
      <motion.span
        key="trial-boost"
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 2.4, repeat: Infinity }}
        className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-accent to-primary px-2 py-0.5 text-[11px] font-bold text-white shadow-sm"
      >
        <Rocket className="h-3 w-3" /> Novo em Destaque
      </motion.span>
    );
  }
  // Frescor de atividade (Lote 4) — prioridade: Trabalhando Agora > Disponível agora > Ativo Hoje > Resposta rápida
  const fastByChat = provider.avgResponseMinutes != null && provider.avgResponseMinutes > 0 && provider.avgResponseMinutes < 30;
  if (workingNow) {
    badges.push(
      <motion.span
        key="working-now"
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
      >
        <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500 animate-pulse" /> Trabalhando agora
      </motion.span>
    );
  } else if (isOnline) {
    badges.push(<OnlineBadge key="fast-online" userId={provider.userId} showFreshness />);
  } else if (activeToday) {
    badges.push(
      <span key="active-today" className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400 border border-blue-500/20">
        <Sparkles className="h-3 w-3" /> Ativo hoje
      </span>
    );
  } else if (fastByChat) {
    badges.push(
      <span key="fast-chat" className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
        <Zap className="h-3 w-3" /> Responde em ~{provider.avgResponseMinutes}min
      </span>
    );
  } else {
    // Sem destaque ativo: se ficou offline recentemente (lastSeen), badge "Offline" com tooltip
    badges.push(<OnlineBadge key="offline-lastseen" userId={provider.userId} showOffline />);
  }

  // Sinal de Vida (Recency Factor) — em alta / responde rápido / ativo recente
  if (provider.activitySignal && !isOnline) {
    badges.push(<ActivitySignalBadge key="activity-signal" signal={provider.activitySignal} />);
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
      className={`group relative flex h-full min-h-[248px] min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-card transition-shadow duration-300 hover:shadow-card-hover ${engTier.borderClass}`}
      {...handlers}
    >
      {/* Hover gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/0 to-primary/0 group-hover:from-accent/5 group-hover:to-primary/5 transition-all duration-500 rounded-xl" />
      {/* Shine sweep */}
      <div className="card-shine-sweep pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent" style={{ left: '-100%', width: '50%' }} />

      {/* Favorite (heart) — top-right */}
      <FavoriteButton providerId={provider.id} providerName={displayName} className="absolute right-2 top-2 z-10" />

      <div className="relative flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
           <Avatar className="h-12 w-12 shrink-0 ring-2 ring-transparent transition-transform duration-300 group-hover:scale-105 group-hover:ring-accent/20 sm:h-14 sm:w-14">
            <AvatarImage
              src={getOptimizedUrl(displayPhoto, 112) || displayPhoto || undefined}
              srcSet={responsiveImageSrcSet(displayPhoto, [112, 168, 224], 72) || undefined}
              sizes="(max-width: 640px) 48px, 56px"
              alt={displayName}
              loading={index < 3 ? 'eager' : 'lazy'}
              fetchPriority={index < 3 ? 'high' : 'auto'}
              decoding="async"
              onError={handleImageError}
            />
            <AvatarFallback className="bg-primary/10">
              <CategoryIcon icon={provider.categoryIcon || ''} size={24} className="text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 overflow-hidden">
            <Link
              to={`/profissional/${provider.slug}`}
              className="block min-w-0 max-w-full"
              onClick={() => trackProfileClick(provider.id, provider.slug, trackingSource)}
              {...handlers}
            >
              <div className="flex min-w-0 items-start justify-between gap-2 overflow-hidden">
                <h3 className="min-w-0 flex-1 truncate font-display text-sm font-bold leading-tight text-foreground transition-colors group-hover:text-accent sm:text-base">
                  <span className="inline-flex items-center gap-1 max-w-full">
                    <span className="truncate">{displayName}</span>
                    {provider.communityVerified && (
                      <CommunityVerifiedBadge size="sm" />
                    )}
                    {isTopProfessional && <TopProfessionalBadge size="sm" />}
                  </span>
                </h3>
                {engTier.showCrown && (
                  <motion.div animate={{ rotate: [0, 12, -12, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}>
                    <Crown className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-label="Destaque" />
                  </motion.div>
                )}
                {engTier.tier === 'ouro' && (
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-label="Ouro" />
                )}
              </div>
            </Link>
            {provider.businessName && normalizeProviderToken(provider.businessName) !== nameNorm && !isDuplicateCategoryLabel(displayName, provider.businessName) && (
              <p className="truncate text-xs text-muted-foreground">{provider.businessName}</p>
            )}
            {provider.category && !categoryDuplicatesName && (
              <p className="mt-0.5 truncate text-xs font-medium text-accent sm:text-sm">{provider.category}</p>
            )}
            {altSubtitle && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">{altSubtitle}</p>
            )}
            {hasLocation && (
              <div className="mt-1 flex min-w-0 max-w-full flex-wrap items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate min-w-0 flex-1">{locationText}</span>
                {trustedDistanceKm != null ? (
                  <span
                    className="ml-1 shrink-0 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                    title={provider._distanceAudit?.source === 'city-center'
                      ? 'Distância estimada com correção pelo centro da cidade declarada'
                      : `Aproximadamente ${Math.max(1, Math.round((trustedDistanceKm / 30) * 60))} min de carro (30 km/h)`}
                  >
                    {trustedDistanceKm < 1 ? '< 1' : trustedDistanceKm.toFixed(1)} km
                    <span className="opacity-70">·</span>
                    <Clock className="h-2.5 w-2.5" />
                    {Math.max(1, Math.round((trustedDistanceKm / 30) * 60))}min
                  </span>
                ) : (provider._distanceAudit !== undefined || provider.distanceKm !== undefined) && (
                  <span
                    className="ml-1 shrink-0 inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                    title="Não foi possível calcular a distância — coordenadas do profissional ou do usuário indisponíveis."
                    data-testid="distance-unavailable"
                  >
                    <MapPin className="h-2.5 w-2.5" />
                    Distância indisponível
                  </span>
                )}
                {/* Audit chip — visível apenas em DEV ou quando ?audit=1 está na URL */}
                {provider._distanceAudit && (typeof window !== 'undefined') && (
                  (import.meta as any)?.env?.DEV || window.location.search.includes('audit=1')
                ) && (
                  <span
                    className={`ml-1 shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wide ${
                      provider._distanceAudit.suspicious
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                    title={
                      provider._distanceAudit.suspicious
                        ? `Suspeito: coords do provider divergem do centro de ${provider._distanceAudit.providerCity}. Usando distância via centro da cidade.`
                        : `Distância calculada por coordenadas diretas (origem: ${provider._distanceAudit.source}).`
                    }
                  >
                    {provider._distanceAudit.source === 'city-center' ? 'centro-cidade' : 'direta'}
                    {provider._distanceAudit.suspicious ? ' suspeita' : ''}
                  </span>
                )}
              </div>
            )}
            {/* Hiper-local: matador para conversão quando o profissional está a <5km */}
            {trustedDistanceKm != null && trustedDistanceKm < 5 && !isFallback && !suspiciousDistance && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Atende agora no seu bairro
              </motion.div>
            )}
            {provider._distanceAudit?.source === 'city-center' && (
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                Distância estimada pela cidade declarada{provider._distanceAudit.suspicious ? ' após correção de coordenadas inconsistentes' : ''}.
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

        <div className="mt-3 flex w-full min-w-0 flex-row items-stretch gap-2 overflow-hidden sm:mt-4">
          {provider.whatsapp && (
            <Button size="sm" className="h-10 min-w-0 flex-1 basis-0 px-3 text-xs transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] sm:text-sm bg-[#25D366] hover:bg-[#1da851] text-white border-0" asChild>
              <a
                href={whatsappLink(provider.whatsapp, buildSmartMessage(displayName, provider.category, geoCity, geoState))}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick(provider.id, provider.slug, trackingSource)}
                className="inline-flex w-full min-w-0 items-center justify-center gap-1.5 truncate"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 icon-cta icon-bounce" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                <span className="truncate">WhatsApp</span>
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" className={`h-10 px-3 text-xs transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] sm:text-sm ${provider.whatsapp ? 'min-w-[104px] max-w-[128px] shrink-0 whitespace-nowrap' : 'flex-1'}`} asChild>
            <Link
              to={`/profissional/${provider.slug}`}
              onClick={() => trackProfileClick(provider.id, provider.slug, trackingSource)}
              {...handlers}
              className="inline-flex w-full items-center justify-center gap-1 truncate"
            >
              <span className="truncate">Ver Perfil</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            </Link>
          </Button>
        </div>
        <p className="mt-1 sm:mt-1.5 text-center text-[10px] text-muted-foreground">Negociação direta e transparente</p>
      </div>
    </motion.div>
  );
};

// Memoize to avoid re-rendering all cards on each Realtime presence sync.
// Card subscribes to its own provider's online state via useIsProviderOnline;
// other providers' presence changes don't affect rendered output.
export default memo(ProviderCard, (prev, next) => {
  if (prev.provider !== next.provider && prev.provider.id !== next.provider.id) return false;
  if (prev.isFallback !== next.isFallback) return false;
  if (prev.trackingSource !== next.trackingSource) return false;
  if (prev.index !== next.index) return false;
  // Provider is the same row → re-render only if a meaningful field shifted
  return prev.provider.id === next.provider.id
    && prev.provider.featured === next.provider.featured
    && prev.provider.rating === next.provider.rating
    && prev.provider.reviewCount === next.provider.reviewCount
    && prev.provider.distanceKm === next.provider.distanceKm
    && prev.provider.serviceImage === next.provider.serviceImage;
});

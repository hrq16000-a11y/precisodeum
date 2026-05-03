import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { avatarThumb, serviceImageThumb } from '@/lib/imageOptimizer';
import { normalize } from '@/lib/normalize';
import GeoEngine from '@/lib/geoEngine';
import type { GeoIntent } from '@/lib/geoEngine';
import SearchIntelligence from '@/lib/searchIntelligence';
import { sanitizeSearchTokens } from '@/lib/searchSanitizer';
import { calculateDistanceKm, hasCoordinates } from '@/lib/geoDistance';
import { resolveDisplayName as _centralResolveDisplayName } from '@/lib/providerDisplay';
import { getCityCoords } from '@/lib/cityCoords';
import {
  expandSearchTerms as _expandSearchTermsShared,
  evaluateTextMatch,
  normalizeSearchText,
} from '@/lib/searchNormalization';
import { calculateAuditedDistanceKm, type DistanceAudit } from '@/lib/distanceAudit';

/** Track impression for fairness system — fire-and-forget */
export function trackProviderImpressions(providerIds: string[]) {
  if (!providerIds.length) return;
  // Batch via RPC — one call per provider (lightweight)
  providerIds.forEach(id => {
    supabase.rpc('increment_provider_impression', { _provider_id: id }).then(() => {});
  });
}

export interface DbProvider {
  id: string;
  userId: string;
  createdAt?: string | null;
  name: string;
  businessName?: string;
  category: string;
  categorySlug: string;
  categoryIcon: string;
  city: string;
  state: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  rating: number;
  reviewCount: number;
  photo: string;
  serviceImage?: string;
  hasPortfolio?: boolean;
  description: string;
  phone: string;
  whatsapp: string;
  yearsExperience: number;
  slug: string;
  featured: boolean;
  servicesCount: number;
  portfolioAlbumCount: number;
  portfolioPhotoCount: number;
  distanceKm?: number;
  /** Cached avg minutes between lead arrival and provider's first chat reply */
  avgResponseMinutes?: number | null;
  /** When the trial visibility boost (7 days after onboarding checklist) expires */
  trialBoostUntil?: string | null;
  /** "Verificado pela Comunidade" — auto-granted when 3 requirements are met */
  communityVerified?: boolean;
  levelName?: string | null;
  levelPriority?: number;
  /** Audit metadata about how distance was computed (debug/inspection) */
  _distanceAudit?: DistanceAudit;
  /** Sinal de atividade do prestador (Recency Factor) */
  activitySignal?: 'em_alta' | 'responde_rapido' | 'ativo_recente' | null;
  /** Tipo de conta — 'autonomous' (PF, default) ou 'company' (PJ). */
  accountType?: 'autonomous' | 'company' | string | null;
  /** PJ: segmento de atuação. */
  businessSegment?: string | null;
  /** PJ: endereço institucional. */
  street?: string | null;
  streetNumber?: string | null;
  complement?: string | null;
  postalCode?: string | null;
  /** PJ: links para redes sociais e site institucional. */
  socialLinks?: Record<string, string> | null;
  /** PJ: razão social. */
  legalName?: string | null;
  /** PJ: indica se rua/número devem ser exibidos publicamente. */
  showFullAddress?: boolean;
  /** Horário (texto livre legado) e struct estruturado (Google-Meu-Negócio). */
  workingHours?: string | null;
  workingHoursStruct?: {
    ranges: Array<{ days: string[]; start: string; end: string }>;
  } | null;
  /** Flags derivadas (calculadas no DB por trigger). */
  opensWeekend?: boolean;
  opensLateNight?: boolean;
  opensOvernight?: boolean;
  is24h?: boolean;
  acceptsOnDemand?: boolean;
}

export type FeaturedProviderSort = 'proximity' | 'category' | 'availability';

export interface FeaturedProvidersOptions {
  enabled?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  userCity?: string;
  categorySlug?: string;
  sortBy?: FeaturedProviderSort;
  limit?: number;
}

const FEATURED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FEATURED_CACHE_VERSION = 'v3';

const GENERIC_PROVIDER_NAME_TOKENS = new Set([
  'pedreiro', 'padeiro', 'padreiro', 'eletricista', 'encanador', 'pintor', 'autonomo', 'profissional',
  'empreiteiro', 'marceneiro', 'jardineiro', 'tecnico', 'mecanico', 'servicosgerais', 'diarista',
  'cozinheiro', 'motorista', 'soldador', 'vidraceiro', 'gesseiro', 'azulejista', 'prestador',
  'profissionalautonomo', 'servico', 'servicos', 'autonoma', 'prestadora', 'tecnica',
]);

const normalizeProviderToken = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');

const isGenericProviderName = (s?: string | null) => {
  if (!s) return true;
  const normalized = normalizeProviderToken(s);
  return !normalized || GENERIC_PROVIDER_NAME_TOKENS.has(normalized);
};

const humanizeProviderSlug = (slug?: string | null) => {
  if (!slug) return '';
  const base = slug
    .replace(/-[a-f0-9]{6,}$/i, '')
    .replace(/\b\d+\b/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!base || isGenericProviderName(base)) return '';
  if (/^profissional(\s+em\s+.+)?$/i.test(base)) return '';

  return base
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const featuredCacheKey = ({ latitude, longitude, categorySlug, sortBy, limit }: FeaturedProvidersOptions) =>
  `featured-providers:${FEATURED_CACHE_VERSION}:${categorySlug || 'all'}:${sortBy || 'proximity'}:${limit || 6}:${latitude?.toFixed(2) || 'na'}:${longitude?.toFixed(2) || 'na'}`;

const readFeaturedCache = (key: string): DbProvider[] | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    const cached = JSON.parse(localStorage.getItem(key) || 'null');
    if (!cached?.time || Date.now() - cached.time > FEATURED_CACHE_TTL_MS) return undefined;
    if (!Array.isArray(cached.data)) return undefined;

    const hasWeakEntry = cached.data.some((provider: DbProvider) => {
      const displayName = (provider?.name || '').trim();
      const category = (provider?.category || '').trim();
      const normalizedName = normalizeProviderToken(displayName);
      const normalizedCategory = normalizeProviderToken(category);

      return (
        !displayName ||
        /^profissional(\s+em\s+.+)?$/i.test(displayName) ||
        isGenericProviderName(displayName) ||
        (!!normalizedCategory && normalizedName === normalizedCategory)
      );
    });

    return hasWeakEntry ? undefined : cached.data;
  } catch {
    return undefined;
  }
};

const writeFeaturedCache = (key: string, data: DbProvider[], metrics: Record<string, number | string>) => {
  if (typeof window === 'undefined' || data.length === 0) return;
  try {
    localStorage.setItem(key, JSON.stringify({ time: Date.now(), data }));
    (window as any).__featuredProvidersMetrics = { ...(window as any).__featuredProvidersMetrics, ...metrics, cacheKey: key };
  } catch { /* ignore quota */ }
};

export const hashRotationSeed = (input: string) => {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  return Math.abs(hash) || 1;
};

export const seededShuffle = <T,>(items: T[], seed: number) => {
  const arr = [...items];
  let current = seed || 1;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    current = (current * 9301 + 49297) % 233280;
    const j = Math.floor((current / 233280) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Constrói a seed estável usada para rotação dos destaques.
 * Usa APENAS variáveis estáveis (data, sortBy, categoria, cidade) — nunca lat/lng cruas.
 */
export const buildFeaturedRotationSeed = (params: {
  dateKey?: string;
  sortBy: FeaturedProviderSort;
  categorySlug?: string | null;
  userCity?: string | null;
}) => {
  const dateKey = params.dateKey || new Date().toISOString().slice(0, 10);
  const cityKey = (params.userCity || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || 'all';
  return hashRotationSeed(`${dateKey}:${params.sortBy}:${params.categorySlug || 'all'}:${cityKey}`);
};

/** Seed por sessão (browser tab) — usado para desempates do top dos destaques.
 *  Não é "diária": queremos que profissionais com a mesma proximidade+ranking
 *  alternem entre sessões para garantir visibilidade justa, sem reordenar
 *  visivelmente durante a navegação atual.
 */
const FEATURED_SESSION_SEED_KEY = 'pdu:featured:session-seed';
const getFeaturedSessionSeed = (): number => {
  if (typeof window === 'undefined') return 1;
  try {
    const cached = window.sessionStorage.getItem(FEATURED_SESSION_SEED_KEY);
    if (cached) {
      const n = Number(cached);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const seed = Math.floor(Math.random() * 2_147_483_647) || 1;
    window.sessionStorage.setItem(FEATURED_SESSION_SEED_KEY, String(seed));
    return seed;
  } catch {
    return Math.floor(Math.random() * 2_147_483_647) || 1;
  }
};

/** Score de completude do perfil — usado como critério de "ranking" dentro do grupo local. */
const profileCompletenessScore = (p: DbProvider): number => {
  let score = 0;
  if (p.photo) score += 10;
  if (p.businessName || (p.name && p.name.length > 3)) score += 4;
  if (p.description && p.description.length > 40) score += 6;
  if (p.whatsapp) score += 6;
  if (p.servicesCount > 0) score += Math.min(p.servicesCount, 5) * 3;
  if (p.portfolioPhotoCount > 0) score += Math.min(p.portfolioPhotoCount, 10) * 2;
  if (p.portfolioAlbumCount > 0) score += Math.min(p.portfolioAlbumCount, 5) * 3;
  if (p.yearsExperience > 0) score += Math.min(p.yearsExperience, 20);
  if (p.communityVerified) score += 10;
  return score;
};

/** Score combinado de qualidade/ranking (não inclui distância). */
const qualityRankScore = (p: DbProvider): number => {
  const finalScore = (p as any)._finalScore || (p as any)._contentScore || 0;
  const ratingScore = (p.rating || 0) * 4 + Math.min(p.reviewCount || 0, 50) * 0.5;
  const merit = (p.levelPriority || 0) * 8;
  return finalScore + ratingScore + merit + profileCompletenessScore(p);
};

/** Bucketiza distância em faixas para que pequenas variações (±0.5km) não
 *  quebrem desempates por ranking — só "salta" depois de 1 km de diferença.
 */
const distanceBucket = (distanceKm?: number): number => {
  if (!Number.isFinite(distanceKm)) return 9999;
  return Math.floor((distanceKm as number) / 1);
};

const sortFeaturedProviders = (providers: DbProvider[], options: FeaturedProvidersOptions) => {
  const { latitude, longitude, categorySlug, sortBy = 'proximity', userCity } = options as FeaturedProvidersOptions & { userCity?: string };
  const userCityNorm = (userCity || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Fallback: sem GPS → tenta usar centro da cidade do usuário como origem.
  const fallbackUserCoords = (!Number.isFinite(latitude) || !Number.isFinite(longitude)) && userCity
    ? getCityCoords(userCity)
    : null;
  const effectiveLat = Number.isFinite(latitude) ? latitude : fallbackUserCoords?.lat ?? null;
  const effectiveLon = Number.isFinite(longitude) ? longitude : fallbackUserCoords?.lon ?? null;

  const withDistance = providers.map((provider) => {
    if (hasCoordinates(effectiveLat, effectiveLon)) {
      const audit = calculateAuditedDistanceKm(effectiveLat ?? null, effectiveLon ?? null, provider, userCity);
      // Normaliza não-finito → undefined (UI mostra "indisponível", sort empurra pro fim).
      const dKm = Number.isFinite(audit.distanceKm)
        ? Math.round(audit.distanceKm * 10) / 10
        : undefined;
      return { ...provider, distanceKm: dKm, _distanceAudit: audit };
    }
    return provider;
  });

  const filtered = categorySlug ? withDistance.filter((p) => p.categorySlug === categorySlug) : withDistance;

  // ---- LÓGICA "Local → Ranking → Shuffle por sessão" ----
  // 1) Marca quem é local (mesma cidade do usuário, quando disponível).
  const isSameCity = (p: DbProvider) =>
    !!userCityNorm &&
    (p.city || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === userCityNorm;

  const annotated = filtered.map((p) => ({
    p,
    local: isSameCity(p),
    bucket: distanceBucket(p.distanceKm),
    quality: qualityRankScore(p),
  }));

  // 2) Ordenação determinística:
  //    - Locais primeiro (sempre).
  //    - Depois por bucket de distância (±1km).
  //    - Depois por score de qualidade/completude (decrescente).
  //    - Empate final: comparator existente.
  annotated.sort((a, b) => {
    if (a.local !== b.local) return a.local ? -1 : 1;
    if (sortBy === 'category') {
      const cat = a.p.category.localeCompare(b.p.category);
      if (cat !== 0) return cat;
    }
    if (a.bucket !== b.bucket) return a.bucket - b.bucket;
    if (a.quality !== b.quality) return b.quality - a.quality;
    return compareEliteMerit(a.p, b.p);
  });

  // 3) Para empates verdadeiros (mesmo bucket + mesma quality), aplica
  //    shuffle determinístico por sessão para garantir fairness.
  const sessionSeed = getFeaturedSessionSeed();
  const groups = new Map<string, typeof annotated>();
  for (const entry of annotated) {
    const key = `${entry.local ? 'L' : 'O'}:${entry.bucket}:${Math.round(entry.quality)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }
  const shuffled: typeof annotated = [];
  for (const [, group] of groups) {
    if (group.length <= 1) shuffled.push(...group);
    else shuffled.push(...seededShuffle(group, sessionSeed));
  }

  return shuffled.map((e) => e.p);
};

interface ServiceFallback {
  serviceName?: string;
  serviceDescription?: string;
  serviceWhatsapp?: string;
  serviceArea?: string;
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickFeaturedCount(total: number): number {
  if (total <= 3) return total;
  const min = 3;
  const max = Math.min(5, total);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function mapProvider(p: any, profileName?: string, serviceImage?: string, hasPortfolio?: boolean, serviceFallback?: ServiceFallback): DbProvider {
  const catName = (p.categories as any)?.name || '';
  const provCity = p.city?.trim() || '';
  const provState = p.state?.trim() || '';
  const provNeighborhood = p.neighborhood?.trim() || '';
  const provDescription = p.description?.trim() || '';
  const provWhatsapp = p.whatsapp?.trim() || '';
  const provPhone = p.phone?.trim() || '';

  const effectiveWhatsapp = provWhatsapp || provPhone || serviceFallback?.serviceWhatsapp || '';
  const effectivePhone = provPhone || provWhatsapp || serviceFallback?.serviceWhatsapp || '';

  const _businessName = (p.business_name || '').trim();
  const _safeBusinessName = isGenericProviderName(_businessName) ? '' : _businessName;
  const _resolvedName =
    (profileName || '').trim() ||
    _safeBusinessName ||
    humanizeProviderSlug(p.slug) ||
    'Profissional';

  return {
    userId: p.user_id,
    id: p.id,
    createdAt: p.created_at || null,
    name: _resolvedName,
    businessName: _safeBusinessName || undefined,
    category: catName || serviceFallback?.serviceName || '',
    categorySlug: (p.categories as any)?.slug || '',
    categoryIcon: (p.categories as any)?.icon || 'Wrench',
    city: provCity,
    state: provState,
    neighborhood: provNeighborhood,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    rating: Number(p.rating_avg) || 0,
    reviewCount: p.review_count || 0,
    photo: p.photo_url || '',
    serviceImage: serviceImage || undefined,
    hasPortfolio: hasPortfolio || false,
    description: provDescription || serviceFallback?.serviceDescription || '',
    phone: effectivePhone,
    whatsapp: effectiveWhatsapp,
    yearsExperience: p.years_experience,
    slug: p.slug || p.id,
    featured: p.featured,
    servicesCount: p.services_count || 0,
    portfolioAlbumCount: p.portfolio_album_count || 0,
    portfolioPhotoCount: p.portfolio_photo_count || 0,
    avgResponseMinutes: p.avg_response_minutes ?? null,
    communityVerified: !!p.community_verified,
    workingHours: (p as any).working_hours ?? null,
    workingHoursStruct: ((p as any).working_hours_struct as any) ?? null,
    opensWeekend: !!(p as any).opens_weekend,
    opensLateNight: !!(p as any).opens_late_night,
    opensOvernight: !!(p as any).opens_overnight,
    is24h: !!(p as any).is_24h,
    acceptsOnDemand: !!(p as any).accepts_on_demand,
  };
}

const providerSelect = 'id, user_id, created_at, business_name, description, photo_url, city, state, neighborhood, latitude, longitude, phone, whatsapp, years_experience, slug, featured, rating_avg, review_count, status, category_id, portfolio_photo_count, portfolio_album_count, services_count, avg_response_minutes, community_verified, working_hours, working_hours_struct, opens_weekend, opens_late_night, opens_overnight, is_24h, accepts_on_demand, categories(name, slug, icon)';

function compareEliteMerit(a: DbProvider, b: DbProvider): number {
  const levelDiff = (b.levelPriority || 0) - (a.levelPriority || 0);
  if (levelDiff !== 0) return levelDiff;
  const ratingDiff = (b.rating || 0) - (a.rating || 0);
  if (Math.abs(ratingDiff) > 0.001) return ratingDiff;
  const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (aCreated !== bCreated) return aCreated - bCreated;
  const photoDiff = (b.portfolioPhotoCount || 0) - (a.portfolioPhotoCount || 0);
  if (photoDiff !== 0) return photoDiff;
  return (b.reviewCount || 0) - (a.reviewCount || 0);
}

// --- Ranking config cache ---
let _rankingConfig: { boostMul: number; fairnessPen: number; randomMax: number } | null = null;
let _rankingConfigTime = 0;

async function getRankingConfig() {
  const now = Date.now();
  if (_rankingConfig && now - _rankingConfigTime < 5 * 60_000) return _rankingConfig;
  const { data } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', ['ranking_boost_multiplier', 'ranking_fairness_penalty', 'ranking_random_factor']);
  const map: Record<string, string> = {};
  (data || []).forEach((s: any) => { map[s.key] = s.value; });
  _rankingConfig = {
    boostMul: Number(map['ranking_boost_multiplier']) || 20,
    fairnessPen: Number(map['ranking_fairness_penalty']) || 5,
    randomMax: Number(map['ranking_random_factor']) || 5,
  };
  _rankingConfigTime = now;
  return _rankingConfig;
}

/**
 * Lightweight fetch — uses counter columns + boost/impressions for hybrid ranking.
 */
async function fetchProvidersLightweight(query: any) {
  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const providerIds = (data as any[]).map((p) => p.id);
  const userIds = [...new Set((data as any[]).map((p) => p.user_id))];

  // 5 parallel fetches (includes engagement for meritocracy scoring)
  const [profilesRes, servicesRes, boostsRes, impressionsRes, rankConfig, engagementRes] = await Promise.all([
    supabase
      .from('public_profiles' as any)
      .select('id, full_name, avatar_url')
      .in('id', userIds)
      .limit(200) as unknown as Promise<{ data: { id: string; full_name: string; avatar_url: string | null }[] | null }>,
    supabase
      .from('services')
      .select('id, provider_id, service_name, description, whatsapp, service_area, is_emergency, seo_tags, service_images(image_url, display_order)')
      .in('provider_id', providerIds)
      .limit(500),
    supabase
      .from('provider_boosts' as any)
      .select('provider_id, boost_weight')
      .in('provider_id', providerIds)
      .eq('is_active', true)
      .lte('start_at', new Date().toISOString())
      .gte('end_at', new Date().toISOString())
      .limit(200)
      .then((res: any) => ({ data: res.error ? [] : (res.data || []) })),
    supabase
      .from('provider_impressions' as any)
      .select('provider_id, impressions')
      .in('provider_id', providerIds)
      .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)) as any,
    getRankingConfig(),
    // Fetch engagement points + level priority + trial boost for meritocracy scoring
    supabase
      .from('profiles')
      .select('id, engagement_points, level_id, trial_boost_until, gamification_levels!profiles_level_id_fkey(name, priority)')
      .in('id', userIds)
      .limit(200) as any,
  ]);

  const profileMap: Record<string, { name: string; avatar?: string }> = {};
  (profilesRes.data || []).forEach((p: any) => {
    profileMap[p.id] = { name: p.full_name, avatar: p.avatar_url || undefined };
  });

  // Boost aggregation
  const boostMap: Record<string, number> = {};
  (boostsRes.data || []).forEach((b: any) => {
    boostMap[b.provider_id] = (boostMap[b.provider_id] || 0) + (b.boost_weight || 0);
  });

  // Impressions aggregation (last 7 days)
  const impressionMap: Record<string, number> = {};
  (impressionsRes.data || []).forEach((i: any) => {
    impressionMap[i.provider_id] = (impressionMap[i.provider_id] || 0) + (i.impressions || 0);
  });

  // Engagement/meritocracy aggregation (+ trial boost flag)
  const engagementMap: Record<string, { points: number; priority: number; levelName: string | null; trialBoostUntil: string | null }> = {};
  ((engagementRes as any)?.data || []).forEach((e: any) => {
    const lvl = e.gamification_levels;
    const levelRow = Array.isArray(lvl) ? lvl[0] : lvl;
    engagementMap[e.id] = {
      points: e.engagement_points || 0,
      priority: levelRow?.priority || 0,
      levelName: levelRow?.name || null,
      trialBoostUntil: e.trial_boost_until || null,
    };
  });

  const serviceRows = servicesRes.data || [];
  const serviceFallbackMap: Record<string, ServiceFallback> = {};
  const serviceImageMap: Record<string, string> = {};
  serviceRows.forEach((s: any) => {
    if (!serviceFallbackMap[s.provider_id]) {
      serviceFallbackMap[s.provider_id] = {
        serviceName: s.service_name || undefined,
        serviceDescription: s.description || undefined,
        serviceWhatsapp: s.whatsapp || undefined,
        serviceArea: s.service_area || undefined,
      };
    }
    if (!serviceImageMap[s.provider_id]) {
      const images = Array.isArray(s.service_images) ? s.service_images : [];
      const firstImage = images
        .slice()
        .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))[0]?.image_url;
      if (firstImage) {
        serviceImageMap[s.provider_id] = firstImage;
      }
    }
  });

  // Check admin settings for visibility rules
  let hideIncomplete = false;
  let requireCityForVisibility = false;
  try {
    const { data: settingsData } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['incomplete_profile_hide_public', 'require_city_for_visibility']);
    (settingsData || []).forEach((s: any) => {
      if (s.key === 'incomplete_profile_hide_public') hideIncomplete = s.value === 'true';
      if (s.key === 'require_city_for_visibility') requireCityForVisibility = s.value === 'true';
    });
  } catch { /* ignore */ }

  return (data as any[]).map((p) => {
    const profile = profileMap[p.user_id];
    // Priority: profile.avatar (verified selfie) > providers.photo_url > generated fallback
    const rawPhoto = profile?.avatar || p.photo_url || '';
    const photoCount = p.portfolio_photo_count || 0;
    const albumCount = p.portfolio_album_count || 0;
    const svcCount = p.services_count || 0;
    const hasPortfolio = photoCount > 0;

    const mapped = mapProvider(
      { ...p, photo_url: avatarThumb(rawPhoto) },
      profile?.name,
      serviceImageThumb(serviceImageMap[p.id]),
      hasPortfolio,
      serviceFallbackMap[p.id]
    );

    // Aggregate all service texts for deep search matching
    const provServices = (serviceRows as any[]).filter(s => s.provider_id === p.id);
    const svcTexts = provServices.map(s =>
      [s.service_name || '', s.description || '', s.service_area || '', ...(s.seo_tags || [])].join(' ')
    ).join(' ');
    (mapped as any)._searchableServices = svcTexts;

    // Emergency flag: true if any service has is_emergency
    (mapped as any)._hasEmergencyService = provServices.some(s => s.is_emergency === true);

    // Mark incomplete profiles for filtering. A profile is "incomplete" when:
    //  - it has no usable display name, OR
    //  - city is missing while admin requires it, OR
    //  - the only available "name" is a generic profession AND no real avatar
    //    exists (so the card would render with both a generic name and a
    //    placeholder avatar — visually weak).
    const profileNameTrimmed = (profile?.name?.trim()) || '';
    const businessNameTrimmed = (p.business_name?.trim()) || '';
    const displayName = profileNameTrimmed || businessNameTrimmed || (p.slug?.trim()) || '';
    const provCity = p.city?.trim() || '';
    const onlyGenericName = !profileNameTrimmed && isGenericProviderName(businessNameTrimmed);
    const hasRealAvatar = !!rawPhoto;
    const isIncomplete =
      !displayName ||
      (requireCityForVisibility && !provCity) ||
      (onlyGenericName && !hasRealAvatar);
    (mapped as any)._isIncomplete = isIncomplete;

    // Hybrid score with MERITOCRACY weighting
    // Capped content score (anti-abuse)
    const photoScore = Math.min(photoCount, 20) * 2;
    const albumScore = Math.min(albumCount, 5) * 5;
    const contentScore =
      (rawPhoto ? 10 : 0) +
      (svcCount >= 1 ? 2 : 0) +
      (svcCount >= 3 ? 3 : 0) +
      photoScore +
      albumScore +
      (svcCount > 0 && photoCount > 0 ? 5 : 0);
    const boostScore = boostMap[p.id] || 0;
    const impressions7d = impressionMap[p.id] || 0;
    const fairnessPenalty = Math.log(1 + impressions7d) * rankConfig.fairnessPen;
    const randomFactor = Math.random() * rankConfig.randomMax;

    // MERITOCRACY: aggressive level priority weight (priority * 15)
    const engData = engagementMap[p.user_id];
    const levelPriority = engData?.priority || 0;
    const engagementPts = engData?.points || 0;
    const meritScore = (levelPriority * 15) + Math.min(engagementPts, 200) * 0.3;

    // TRIAL BOOST: dedicated flag — gives a real but bounded push (≈ tier 'engajado')
    // without overriding meritocracy of established providers
    const trialBoostUntil = engData?.trialBoostUntil;
    const trialBoostActive = !!trialBoostUntil && new Date(trialBoostUntil).getTime() > Date.now();
    const trialBoostScore = trialBoostActive ? 25 : 0;

    const finalScore = contentScore + meritScore + trialBoostScore + (boostScore * rankConfig.boostMul) - fairnessPenalty + randomFactor;

    (mapped as any)._contentScore = contentScore;
    (mapped as any)._finalScore = finalScore;
    (mapped as any)._boostScore = boostScore;
    mapped.levelPriority = levelPriority;
    mapped.levelName = engData?.levelName || null;
    mapped.trialBoostUntil = trialBoostUntil;
    return mapped;
  }).filter(p => !hideIncomplete || !(p as any)._isIncomplete);
}

// fetchProvidersWithProfiles now uses the same fast path
const fetchProvidersWithProfiles = fetchProvidersLightweight;

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, icon')
        .order('name');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useCategoriesWithCount() {
  return useQuery({
    queryKey: ['categories-with-count'],
    queryFn: async () => {
      const [catsRes, provsRes] = await Promise.all([
        supabase.from('categories').select('id, name, slug, icon, parent_id').is('deleted_at', null).order('name'),
        supabase.from('providers').select('category_id').eq('status', 'approved').limit(1000),
      ]);

      if (catsRes.error) throw catsRes.error;

      const countMap: Record<string, number> = {};
      (provsRes.data || []).forEach((p) => {
        if (p.category_id) countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
      });

      return (catsRes.data || []).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        parent_id: c.parent_id as string | null,
        count: countMap[c.id] || 0,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useFeaturedProviders(options: boolean | FeaturedProvidersOptions = true) {
  const normalizedOptions: FeaturedProvidersOptions = typeof options === 'boolean' ? { enabled: options } : options;
  const { enabled = true, latitude, longitude, categorySlug, sortBy = 'proximity', limit = 6 } = normalizedOptions;
  const cacheKey = featuredCacheKey(normalizedOptions);

  return useQuery({
    queryKey: ['featured-providers', categorySlug || 'all', sortBy, limit, latitude?.toFixed(3) || null, longitude?.toFixed(3) || null],
    queryFn: async (): Promise<DbProvider[]> => {
      const startedAt = performance.now();
      const { data, error, count } = await supabase.rpc('get_featured_providers', { _limit: Math.max(limit * 3, 12) });
      const queryMs = Math.round((performance.now() - startedAt) * 100) / 100;
      if (error) throw error;
      const rows = (data || []) as any[];
      if (rows.length === 0) return [];

      // Enriquecimento: busca full_name + avatar_url dos perfis em batch.
      // Sem isso, business_name genéricos ("Pedreiro", "Autônomo") vazam para o card.
      const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      const profileMap: Record<string, { name: string | null; avatar: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('public_profiles' as any)
          .select('id, full_name, avatar_url')
          .in('id', userIds);
        (profs as any[] | null)?.forEach((p) => {
          profileMap[p.id] = { name: p.full_name || null, avatar: p.avatar_url || null };
        });
      }

      // Map MV rows (snake_case + flat category fields) to DbProvider shape
      const mappedRows = rows.map((p) => {
        const provWhatsapp = (p.whatsapp || '').trim();
        const provPhone = (p.phone || '').trim();
        const effectiveWhatsapp = provWhatsapp || provPhone || '';
        const effectivePhone = provPhone || provWhatsapp || '';
        const profile = profileMap[p.user_id];

        // Centralized name + avatar resolution (consistent across all feeds)
        const fullName = profile?.name?.trim() || '';
        const businessName = (p.business_name || '').trim();
        const isCompany = (p.account_type || 'autonomous') === 'company';
        const safeBusinessName = isCompany
          ? businessName
          : (isGenericProviderName(businessName) ? '' : businessName);
        const resolvedName = _centralResolveDisplayName({
          profileFullName: fullName,
          businessName,
          slug: p.slug,
          city: p.city,
          accountType: p.account_type,
        });

        // Avatar: profile.avatar_url > providers.photo_url > fallback (handled by ProviderCard)
        const resolvedPhoto = (profile?.avatar || p.photo_url || '').trim();

        const mapped: DbProvider = {
          id: p.id,
          userId: p.user_id,
          name: resolvedName,
          businessName: safeBusinessName || undefined,
          category: p.category_name || '',
          categorySlug: p.category_slug || '',
          categoryIcon: p.category_icon || 'Wrench',
          city: (p.city || '').trim(),
          state: (p.state || '').trim(),
          neighborhood: (p.neighborhood || '').trim(),
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          rating: Number(p.rating_avg) || 0,
          reviewCount: p.review_count || 0,
          photo: resolvedPhoto,
          serviceImage: undefined,
          hasPortfolio: (p.portfolio_photo_count || 0) > 0,
          description: (p.description || '').trim(),
          phone: effectivePhone,
          whatsapp: effectiveWhatsapp,
          yearsExperience: p.years_experience || 0,
          slug: p.slug || p.id,
          featured: !!p.featured,
          servicesCount: p.services_count || 0,
          portfolioAlbumCount: p.portfolio_album_count || 0,
          portfolioPhotoCount: p.portfolio_photo_count || 0,
          accountType: (p.account_type as any) || 'autonomous',
          businessSegment: p.business_segment ?? null,
          street: p.street ?? null,
          streetNumber: p.street_number ?? null,
          complement: p.complement ?? null,
          postalCode: p.postal_code ?? null,
          socialLinks: (p.social_links as any) ?? null,
        };
        return mapped;
      });

      const sorted = sortFeaturedProviders(mappedRows, normalizedOptions).slice(0, limit);
      const payloadBytes = new Blob([JSON.stringify(rows)]).size;
      writeFeaturedCache(cacheKey, sorted, { queryMs, payloadBytes, rows: rows.length, renderedRows: sorted.length, count: count || rows.length });
      return sorted;
    },
    initialData: () => readFeaturedCache(cacheKey),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: 'always',
    refetchInterval: enabled ? 1000 * 60 * 20 : false,
    refetchIntervalInBackground: false,
    enabled,
  });
}

// --- GEO Intelligence v5: delegated to GeoEngine ---

function resolveProviderCoords(provider: DbProvider) {
  return GeoEngine.resolveProviderCoords(provider);
}

// Keep backward compat export
function normalizeCityName(name: string): string {
  return normalize(name);
}

// Backward-compatible wrapper for external callers using old signature
function matchesGeoContextCompat(
  provider: DbProvider,
  cityNorm: string,
  stateNorm?: string,
  userLat?: number | null,
  userLon?: number | null,
  radiusKm?: number,
): boolean {
  const intent = GeoEngine.resolve('', cityNorm, stateNorm);
  const ctx = GeoEngine.buildGeoContext(intent, userLat, userLon);
  if (radiusKm) (ctx as any).radius = radiusKm;
  const pCityNorm = normalize(provider.city);
  const pStateNorm = normalize(provider.state);
  const provCoords = resolveProviderCoords(provider);
  return GeoEngine.matchesGeoContext(pCityNorm, pStateNorm, provCoords, ctx);
}

export { normalizeCityName, matchesGeoContextCompat as matchesGeoContext };

const MIN_LOCAL_RESULTS = 3;
const SEARCH_RESULT_LIMIT = 96;

// Re-export para retrocompatibilidade interna; lógica agora vive em src/lib/searchNormalization.
function expandSearchTerms(rawQuery: string): string[] {
  return _expandSearchTermsShared(rawQuery);
}

/**
 * Wrapper retrocompatível em torno de `calculateAuditedDistanceKm`.
 * Mantém a assinatura antiga usada por outras partes do hook.
 */
function calculateTrustedDistanceKm(
  userLat: number,
  userLon: number,
  provider: Pick<DbProvider, 'latitude' | 'longitude' | 'city'>,
  userCity?: string,
): number {
  const audit = calculateAuditedDistanceKm(userLat, userLon, provider, userCity);
  return audit.distanceKm;
}

export function filterAndRankProviders(
  providers: DbProvider[],
  query: string,
  city: string,
  categorySlug: string,
  minRating: number,
  state?: string,
  userLat?: number | null,
  userLon?: number | null,
  radiusKm?: number
) {
  let results = [...providers];

  if (minRating > 0) {
    results = results.filter((p) => p.rating >= minRating);
  }

  if (categorySlug) {
    results = results.filter((p) => p.categorySlug === categorySlug);
  }

  // --- SIL v1: Analyze query via Search Intelligence Layer ---
  const sil = SearchIntelligence.analyze(query, city, state, userLat, userLon);
  const { intent, geoIntent, geoContext, serviceQuery } = sil;

  // Override radius if explicitly provided
  if (radiusKm) (geoContext as any).radius = radiusKm;

  // Apply textual filter using the unified normalization + sinônimos
  if (serviceQuery) {
    const terms = expandSearchTerms(serviceQuery);
    if (terms.length > 0) {
      results = results.filter((p) => evaluateTextMatch(p as any, terms).matched);
    }
  }

  // Route based on SIL intent
  if (intent !== 'SERVICE_ONLY' && (geoContext.cityNorm || geoContext.stateNorm)) {
    const enriched = results.map((p) => {
      const isLocal = SearchIntelligence.matchesGeo(p, geoContext);
      const gs = isLocal ? SearchIntelligence.providerGeoScore(p, geoContext, geoIntent.confidence) : 0;
      const relevance = SearchIntelligence.computeRelevanceScore(p, serviceQuery);
      const scored = SearchIntelligence.computeFinalScore(gs, relevance, intent);
      return { p, isLocal, gs, scored };
    });

    const localResults = enriched.filter((e) => e.isLocal);
    const otherResults = enriched.filter((e) => !e.isLocal);

    let final: typeof enriched;
    if (localResults.length >= MIN_LOCAL_RESULTS) {
      final = localResults;
    } else {
      final = [...localResults, ...otherResults];
    }

    // Sort by: local first, then SIL final score, then existing content score
    final.sort((a, b) => {
      if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
      if (a.scored.finalScore !== b.scored.finalScore) return b.scored.finalScore - a.scored.finalScore;
      const aScore = (a.p as any)._finalScore || (a.p as any)._contentScore || 0;
      const bScore = (b.p as any)._finalScore || (b.p as any)._contentScore || 0;
      if (aScore !== bScore) return bScore - aScore;
      return compareEliteMerit(a.p, b.p);
    });

    SearchIntelligence.trackFinalScore(query, intent, final.length);
    return final.map((e) => e.p);
  }

  // SERVICE_ONLY — sort by existing content score
  results.sort((a, b) => {
    const aScore = (a as any)._finalScore || (a as any)._contentScore || 0;
    const bScore = (b as any)._finalScore || (b as any)._contentScore || 0;
    if (aScore !== bScore) return bScore - aScore;
    return compareEliteMerit(a, b);
  });

  SearchIntelligence.trackFinalScore(query, intent, results.length);
  return results;
}

export interface GroupedSearchResult {
  local: DbProvider[];
  nearby: DbProvider[];
  outOfState: DbProvider[];
  isFallback: boolean;
}

export interface SearchAuditEntry {
  provider: DbProvider;
  beforeRank: number;
  afterRank: number;
  textRel: number;
  distanceKm: number;
  distanceScore: number;
  combinedScore: number;
  isLocal: boolean;
  distanceAudit: DistanceAudit;
  reasons: string[];
}

export interface GroupedSearchAuditResult extends GroupedSearchResult {
  auditEntries: SearchAuditEntry[];
}

export function filterAndRankProvidersGrouped(
  providers: DbProvider[],
  query: string,
  city: string,
  categorySlug: string,
  minRating: number,
  state?: string,
  userLat?: number | null,
  userLon?: number | null,
  radiusKm?: number,
): GroupedSearchAuditResult {
  let results = [...providers];
  const fallbackUserCoords = (!Number.isFinite(userLat) || !Number.isFinite(userLon)) && city ? getCityCoords(city) : null;
  const effectiveUserLat = Number.isFinite(userLat) ? userLat ?? null : fallbackUserCoords?.lat ?? null;
  const effectiveUserLon = Number.isFinite(userLon) ? userLon ?? null : fallbackUserCoords?.lon ?? null;

  if (minRating > 0) {
    results = results.filter((p) => p.rating >= minRating);
  }
  if (categorySlug) {
    results = results.filter((p) => p.categorySlug === categorySlug);
  }

  const sil = SearchIntelligence.analyze(query, city, state, effectiveUserLat, effectiveUserLon);
  const { intent, geoIntent, geoContext, serviceQuery } = sil;
  if (radiusKm) (geoContext as any).radius = radiusKm;

  // Text filter (unified normalization + synonym expansion)
  const _terms = serviceQuery ? expandSearchTerms(serviceQuery) : [];
  const _textMatches = new Map<string, { matched: boolean; score: number; strongMatch: boolean }>();
  if (_terms.length > 0) {
    results = results.filter((p) => {
      const m = evaluateTextMatch(p as any, _terms);
      _textMatches.set(p.id, { matched: m.matched, score: m.score, strongMatch: m.strongMatch });
      return m.matched;
    });
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[GeoAudit] Query:', { query, city, state, userLat, userLon, radiusKm, resultsBefore: results.length, terms: _terms });
  }

  const userCityNorm = city ? normalize(city) : '';

  // Telemetria: conta quantos providers ficaram com distância não-finita
  // (Infinity/NaN). Reportado uma vez por consulta para identificar fontes
  // de coordenadas inválidas (ex: providers sem latitude/longitude no DB).
  let _invalidDistanceCount = 0;

  // Enrich with geo + relevance scores + audited distance
  const enriched = results.map((p, index) => {
    const isLocal = (intent !== 'SERVICE_ONLY' && (geoContext.cityNorm || geoContext.stateNorm))
      ? SearchIntelligence.matchesGeo(p, geoContext)
      : false;
    const gs = isLocal ? SearchIntelligence.providerGeoScore(p, geoContext, geoIntent.confidence) : 0;
    const relevance = SearchIntelligence.computeRelevanceScore(p, serviceQuery);
    const scored = SearchIntelligence.computeFinalScore(gs, relevance, intent);

    // Audited distance — keeps source/suspicious flags for UI.
    // Normaliza qualquer valor não-finito (NaN) para o sentinel `Infinity`
    // — todo o sort downstream usa `=== Infinity` como "sem distância".
    const audit = calculateAuditedDistanceKm(effectiveUserLat, effectiveUserLon, p, city);
    const rawDistance = audit.distanceKm;
    const distanceKm = Number.isFinite(rawDistance) ? rawDistance : Infinity;
    if (!Number.isFinite(rawDistance)) _invalidDistanceCount += 1;

    // Combined text+distance score: avoids weak match closer beating strong match a bit further
    const textRel = _textMatches.get(p.id)?.score ?? (relevance || 0);
    const strongTextMatch = _textMatches.get(p.id)?.strongMatch ?? textRel >= 0.99;
    // Distance score in [0..1]: 1 if very close, 0 if 30km+ away
    const distScore = distanceKm === Infinity ? 0 : Math.max(0, 1 - distanceKm / 60);
    // Texto pesa mais (0.7) que distância (0.3) — relevância nunca é dominada por proximidade
    const cityPriority = userCityNorm && normalize(p.city) === userCityNorm ? 0.08 : 0;
    const combinedScore = textRel * 0.82 + distScore * 0.18 + cityPriority;

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(
        `[GeoAudit] ${p.name} | dist=${distanceKm === Infinity ? 'N/A' : distanceKm.toFixed(1) + 'km'} src=${audit.source}${audit.suspicious ? ' SUSPICIOUS' : ''} | text=${textRel.toFixed(2)} combined=${combinedScore.toFixed(2)} local=${isLocal}`
      );
    }

    return { p, isLocal, scored, distanceKm, audit, textRel, strongTextMatch, distScore, combinedScore, originalIndex: index };
  });

  // Telemetria batched — só dispara se houve coords inválidas
  if (_invalidDistanceCount > 0) {
    void import('@/lib/tracking').then(({ trackGeoEvent }) => {
      trackGeoEvent('geo_failed', {
        stage: 'search_invalid_distance_batch',
        invalid_count: String(_invalidDistanceCount),
        total: String(enriched.length),
        had_user_coords: String(Number.isFinite(effectiveUserLat) && Number.isFinite(effectiveUserLon)),
        used_city_fallback: String(!!fallbackUserCoords),
      });
    }).catch(() => {});
  }

  const hasGeoContext = !!(geoContext.cityNorm || geoContext.stateNorm);

  const localArr = hasGeoContext ? enriched.filter(e => e.isLocal) : enriched;
  const otherArr = hasGeoContext ? enriched.filter(e => !e.isLocal) : [];

  const legacyOrdered = [...enriched].sort((a, b) => {
    if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
    if (a.scored.finalScore !== b.scored.finalScore) return b.scored.finalScore - a.scored.finalScore;
    if (a.distanceKm !== Infinity && b.distanceKm !== Infinity) {
      const distDiff = a.distanceKm - b.distanceKm;
      if (Math.abs(distDiff) > 1) return distDiff;
    }
    if (a.distanceKm === Infinity && b.distanceKm !== Infinity) return 1;
    if (b.distanceKm === Infinity && a.distanceKm !== Infinity) return -1;
    return compareEliteMerit(a.p, b.p);
  });
  const legacyRankById = new Map(legacyOrdered.map((entry, idx) => [entry.p.id, idx + 1]));

  // Hybrid sort — texto domina; distância desempata e bônus para mesma cidade.
  const hybridSort = (a: typeof enriched[0], b: typeof enriched[0]) => {
    // Tier 1: bater todos os termos vence quem bate parcial (apenas quando há query)
    if (_terms.length > 0) {
      const aFull = a.strongTextMatch ? 1 : 0;
      const bFull = b.strongTextMatch ? 1 : 0;
      if (aFull !== bFull) return bFull - aFull;
    }
    // Tier 2: mesma cidade do usuário
    if (userCityNorm) {
      const aMatch = normalize(a.p.city) === userCityNorm ? 1 : 0;
      const bMatch = normalize(b.p.city) === userCityNorm ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
    }
    // Tier 3: combined score (texto * 0.7 + distância * 0.3)
    if (Math.abs(a.combinedScore - b.combinedScore) > 0.025) {
      return b.combinedScore - a.combinedScore;
    }
    // Tier 4: distância pura quando combined empata
    if (a.distanceKm !== Infinity && b.distanceKm !== Infinity) {
      const distDiff = a.distanceKm - b.distanceKm;
      if (Math.abs(distDiff) > 1) return distDiff;
    }
    if (a.distanceKm === Infinity && b.distanceKm !== Infinity) return 1;
    if (b.distanceKm === Infinity && a.distanceKm !== Infinity) return -1;
    if (a.scored.finalScore !== b.scored.finalScore) return b.scored.finalScore - a.scored.finalScore;
    return compareEliteMerit(a.p, b.p);
  };

  localArr.sort(hybridSort);
  otherArr.sort(hybridSort);

  const isFallback = hasGeoContext && localArr.length === 0;

  SearchIntelligence.trackFinalScore(query, intent, localArr.length + otherArr.length);

  // Split other into nearby (same state OR <100km) vs outOfState
  const userState = state ? normalize(state) : '';
  const splitOther = (arr: typeof otherArr) => {
    const nearbyArr: typeof otherArr = [];
    const outOfStateArr: typeof otherArr = [];
    arr.forEach(e => {
      const provState = normalize(e.p.state);
      const isNearby = (userState && provState === userState) || (e.distanceKm < 100);
      if (isNearby) nearbyArr.push(e);
      else outOfStateArr.push(e);
    });
    return { nearbyArr, outOfStateArr };
  };

  // In fallback, combine and re-sort by distance, then split
  if (isFallback) {
    const combined = [...localArr, ...otherArr].sort((a, b) => {
      if (a.distanceKm !== Infinity && b.distanceKm !== Infinity) {
        const distDiff = a.distanceKm - b.distanceKm;
        if (Math.abs(distDiff) > 1) return distDiff;
      }
      if (a.distanceKm === Infinity && b.distanceKm !== Infinity) return 1;
      if (b.distanceKm === Infinity && a.distanceKm !== Infinity) return -1;
      return compareEliteMerit(a.p, b.p);
    });
    const { nearbyArr, outOfStateArr } = splitOther(combined);
    const toProvider = (e: typeof combined[0]) => ({
      ...e.p,
      distanceKm: e.distanceKm !== Infinity ? Math.round(e.distanceKm * 10) / 10 : undefined,
      _distanceAudit: e.audit,
    });
    const auditEntries = combined.map((e, afterIndex) => ({
      provider: toProvider(e),
      beforeRank: legacyRankById.get(e.p.id) ?? e.originalIndex + 1,
      afterRank: afterIndex + 1,
      textRel: e.textRel,
      distanceKm: e.distanceKm,
      distanceScore: e.distScore,
      combinedScore: e.combinedScore,
      isLocal: e.isLocal,
      distanceAudit: e.audit,
      reasons: [
        e.strongTextMatch ? 'match textual completo' : 'match textual parcial',
        e.isLocal ? 'mesma cidade/região' : 'fora da cidade-base',
        e.audit.source === 'city-center' ? 'distância corrigida por centro da cidade' : e.audit.source === 'direct' ? 'distância por coordenadas diretas' : 'distância indisponível',
        e.audit.suspicious ? 'coordenadas suspeitas detectadas' : 'coordenadas sem suspeita',
      ],
    }));
    return {
      local: [],
      nearby: nearbyArr.map(toProvider),
      outOfState: outOfStateArr.map(toProvider),
      isFallback,
      auditEntries,
    };
  }

  const { nearbyArr, outOfStateArr } = splitOther(otherArr);
  const toProvider = (e: typeof otherArr[0]) => ({
    ...e.p,
    distanceKm: e.distanceKm !== Infinity ? Math.round(e.distanceKm * 10) / 10 : undefined,
    _distanceAudit: e.audit,
  });

  const finalOrdered = [...localArr, ...nearbyArr, ...outOfStateArr];
  const auditEntries = finalOrdered.map((e, afterIndex) => ({
    provider: toProvider(e),
    beforeRank: legacyRankById.get(e.p.id) ?? e.originalIndex + 1,
    afterRank: afterIndex + 1,
    textRel: e.textRel,
    distanceKm: e.distanceKm,
    distanceScore: e.distScore,
    combinedScore: e.combinedScore,
    isLocal: e.isLocal,
    distanceAudit: e.audit,
    reasons: [
      e.strongTextMatch ? 'match textual completo' : 'match textual parcial',
      normalize(e.p.city) === userCityNorm ? 'cidade exata do usuário' : e.isLocal ? 'mesma região' : 'cidade próxima/fallback',
      e.audit.source === 'city-center' ? 'distância corrigida por centro da cidade' : e.audit.source === 'direct' ? 'distância por coordenadas diretas' : 'distância indisponível',
      e.audit.suspicious ? 'coordenadas suspeitas detectadas' : 'coordenadas sem suspeita',
    ],
  }));

  return {
    local: localArr.map(toProvider),
    nearby: nearbyArr.map(toProvider),
    outOfState: outOfStateArr.map(toProvider),
    isFallback,
    auditEntries,
  };
}

export function useSearchProviders(query: string, city: string, categorySlug: string, minRating: number, state?: string, userLat?: number | null, userLon?: number | null, radiusKm?: number) {
  const baseQuery = useQuery({
    queryKey: ['search-providers-base'],
    queryFn: async () => {
      return fetchProvidersWithProfiles(
        supabase
        .from('providers')
        .select(providerSelect)
        .eq('status', 'approved')
        .order('rating_avg', { ascending: false })
        .order('review_count', { ascending: false })
        .limit(SEARCH_RESULT_LIMIT)
      );
    },
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });

  const filteredData = useMemo(
    () => filterAndRankProviders(baseQuery.data || [], query, city, categorySlug, minRating, state, userLat, userLon, radiusKm),
    [baseQuery.data, query, city, categorySlug, minRating, state, userLat, userLon, radiusKm]
  );

  return {
    ...baseQuery,
    data: filteredData,
  };
}

export function useSearchProvidersGrouped(query: string, city: string, categorySlug: string, minRating: number, state?: string, userLat?: number | null, userLon?: number | null, radiusKm?: number) {
  const baseQuery = useQuery({
    queryKey: ['search-providers-base'],
    queryFn: async () => {
      return fetchProvidersWithProfiles(
        supabase
        .from('providers')
        .select(providerSelect)
        .eq('status', 'approved')
        .order('rating_avg', { ascending: false })
        .order('review_count', { ascending: false })
        .limit(SEARCH_RESULT_LIMIT)
      );
    },
    // Cache /buscar: 15min stale + 60min gc + sem refetch ao remontar/focar.
    // Reduz latência e custo em navegação cidade↔serviço↔CEP dentro da janela.
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const grouped = useMemo(
    () => filterAndRankProvidersGrouped(baseQuery.data || [], query, city, categorySlug, minRating, state, userLat, userLon, radiusKm),
    [baseQuery.data, query, city, categorySlug, minRating, state, userLat, userLon, radiusKm]
  );

  // Fire-and-forget demand log for heatmap
  useEffect(() => {
    if (!query && !categorySlug) return;
    if (userLat == null || userLon == null) return;
    supabase.from('search_demand_logs').insert({
      latitude: userLat,
      longitude: userLon,
      query: query || '',
      category_slug: categorySlug || '',
      city: city || '',
    }).then(() => {});
  }, [query, categorySlug, city, userLat, userLon]);

  return {
    ...baseQuery,
    data: grouped,
  };
}

export function useSearchAuditComparison(query: string, city: string, categorySlug: string, minRating: number, state?: string, userLat?: number | null, userLon?: number | null, radiusKm?: number) {
  const baseQuery = useQuery({
    queryKey: ['search-audit-base'],
    queryFn: async () => fetchProvidersWithProfiles(
      supabase
        .from('providers')
        .select(providerSelect)
        .eq('status', 'approved')
        .order('rating_avg', { ascending: false })
        .order('review_count', { ascending: false })
        .limit(SEARCH_RESULT_LIMIT)
    ),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });

  const data = useMemo(
    () => filterAndRankProvidersGrouped(baseQuery.data || [], query, city, categorySlug, minRating, state, userLat, userLon, radiusKm),
    [baseQuery.data, query, city, categorySlug, minRating, state, userLat, userLon, radiusKm]
  );

  return {
    ...baseQuery,
    data,
  };
}

export function useSearchSuggestions(enabled = true) {
  return useQuery({
    queryKey: ['search-suggestions'],
    queryFn: async () => {
      const [catRes, cityRes, serviceRes] = await Promise.all([
        supabase.from('categories').select('name, slug, icon').order('name'),
        supabase.from('cities').select('name, slug, state').order('name').limit(50),
        supabase.from('popular_services').select('name, slug, category_name').eq('active', true).order('display_order').limit(30),
      ]);
      return {
        categories: catRes.data || [],
        cities: cityRes.data || [],
        services: serviceRes.data || [],
      };
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    enabled,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Returns only categories that have approved providers, sorted by GPS proximity.
 */
export function useGeoCategories(userLat?: number | null, userLon?: number | null) {
  return useQuery({
    queryKey: ['geo-categories', userLat ?? 'none', userLon ?? 'none'],
    queryFn: async () => {
      // Fetch categories + providers with coords in parallel
      const [catsRes, provsRes] = await Promise.all([
        supabase.from('categories').select('id, name, slug, icon'),
        supabase.from('providers').select('category_id, latitude, longitude').eq('status', 'approved').limit(1000),
      ]);
      if (catsRes.error) throw catsRes.error;

      const cats = catsRes.data || [];
      const provs = provsRes.data || [];

      // Build map: category_id -> { count, coords[] }
      const catMap: Record<string, { count: number; coords: { latitude: number; longitude: number }[] }> = {};
      provs.forEach((p: any) => {
        if (!p.category_id) return;
        if (!catMap[p.category_id]) catMap[p.category_id] = { count: 0, coords: [] };
        catMap[p.category_id].count++;
        if (Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) {
          catMap[p.category_id].coords.push({ latitude: p.latitude, longitude: p.longitude });
        }
      });

      // Only categories with providers
      let result = cats
        .filter((c) => catMap[c.id]?.count > 0)
        .map((c) => {
          const info = catMap[c.id];
          let minDistance = Infinity;

          if (userLat != null && userLon != null && Number.isFinite(userLat) && Number.isFinite(userLon)) {
            info.coords.forEach((coord) => {
              const dist = calculateDistanceKmSimple(userLat, userLon, coord.latitude, coord.longitude);
              if (dist < minDistance) minDistance = dist;
            });
          }

          return { ...c, providerCount: info.count, minDistance };
        });

      // Sort: by proximity if GPS available, otherwise by provider count
      if (userLat != null && userLon != null && Number.isFinite(userLat) && Number.isFinite(userLon)) {
        result.sort((a, b) => a.minDistance - b.minDistance);
      } else {
        // Shuffle for variety when no GPS
        for (let i = result.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [result[i], result[j]] = [result[j], result[i]];
        }
      }

      return result;
    },
    staleTime: 1000 * 60 * 5,
  });
}

/** Lightweight Haversine for sorting only */
function calculateDistanceKmSimple(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useCategoryProviders(categorySlug: string) {
  return useQuery({
    queryKey: ['category-providers', categorySlug],
    queryFn: async () => {
      const { data: cat } = await supabase
        .from('categories')
        .select('id, name, slug, icon')
        .eq('slug', categorySlug)
        .maybeSingle();

      if (!cat) return { category: null, providers: [] };

      const providers = await fetchProvidersWithProfiles(
        supabase
          .from('providers')
          .select(providerSelect)
          .eq('status', 'approved')
          .eq('category_id', cat.id)
          .order('rating_avg', { ascending: false })
          .limit(SEARCH_RESULT_LIMIT)
      );

      return { category: cat, providers };
    },
    enabled: !!categorySlug,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });
}

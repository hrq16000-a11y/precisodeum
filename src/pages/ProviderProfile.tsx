import { useParams, Link, useNavigate } from 'react-router-dom';
import { avatarLarge, portfolioThumb, portfolioFull, coverImage, serviceImageThumb, originalUrl, isVideoUrl, isYouTubeUrl, getYouTubeEmbedUrl, getYouTubeThumbnail } from '@/lib/imageOptimizer';
import { handleImageError } from '@/lib/imageResolver';
import { MapPin, Phone, Globe, MessageCircle, Clock, ChevronRight, Crown, Copy, Instagram, Facebook, Youtube, Star, Send, X, Users, Briefcase, Image as ImageIcon, Shield, Award, CheckCircle2, Sparkles, ArrowRight, ThumbsUp, Zap, Eye, Share2, Play, Music, DollarSign, CalendarClock, FolderOpen, Building2, Wrench, Info } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { useAuth } from '@/hooks/useAuth';
import { whatsappLink, telLink, toCanonical } from '@/lib/whatsapp';
import { formatLocationString, capitalizeName } from '@/lib/normalize';
import { useIsMobile } from '@/hooks/use-mobile';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StarRating from '@/components/StarRating';
import ReviewSummary from '@/components/ReviewSummary';
import ProfileBadge from '@/components/ProfileBadge';
import ConversionTags from '@/components/ConversionTags';
import TrustGuarantee from '@/components/TrustGuarantee';
import TestimonialsCarousel from '@/components/TestimonialsCarousel';
import SponsorAd from '@/components/SponsorAd';
import GamificationLevelBadge from '@/components/dashboard/GamificationLevelBadge';
import PublicAchievementsStrip from '@/components/PublicAchievementsStrip';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { lazy, Suspense } from 'react';
import ErrorGuard from '@/components/ErrorGuard';
import { importWithRetry } from '@/lib/lazyWithRetry';
const ImageLightbox = lazy(() => importWithRetry(() => import('@/components/ImageLightbox')));
const AdSlot = lazy(() => importWithRetry(() => import('@/components/ads/AdSlot')));
const SponsorAdSlot = lazy(() => importWithRetry(() => import('@/components/ads/SponsorAdSlot')));
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeSlug } from '@/lib/slugify';
import { toast } from 'sonner';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { useFeatureEnabled, useSettingValue } from '@/hooks/useSiteSettings';
import { useWhatsAppGate } from '@/contexts/WhatsAppGateContext';

/** Fire-and-forget contact click tracker */
const getLeadSource = () => {
  if (typeof window === 'undefined') return 'direto';
  const params = new URLSearchParams(window.location.search);
  const source = (params.get('origem') || params.get('utm_source') || '').toLowerCase();
  if (source.includes('busca') || document.referrer.includes('/buscar')) return 'busca';
  if (source.includes('categoria') || document.referrer.includes('/categoria/')) return 'categoria';
  return 'direto';
};

type ContactCtaOrigin = 'principal' | 'sticky' | 'flutuante' | 'servico';

const trackContactClick = (providerId: string, contactType: 'whatsapp' | 'phone', pagePath: string, serviceName?: string, ctaOrigin: ContactCtaOrigin = 'principal') => {
  try {
    supabase.from('contact_clicks' as any).insert({
      provider_id: providerId,
      contact_type: contactType,
      page_path: pagePath,
      visitor_id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    }).then(() => {});
  } catch { /* silent */ }

  // Also log to audit_log via RPC so the provider's dashboard LeadAnalytics can show it,
  // including visits from anonymous clients.
  try {
    (supabase.rpc as any)('log_provider_public_event', {
      provider_id: providerId,
      event_action: contactType === 'whatsapp' ? 'whatsapp_click' : 'phone_click',
      page_path: pagePath,
      service_name: serviceName || null,
      source_marker: getLeadSource(),
      cta_origin: ctaOrigin,
    }).then(() => {});
  } catch { /* silent */ }
};

/** Fire-and-forget profile view tracker (one entry per session per provider). */
const trackProfileView = (providerId: string) => {
  try {
    const key = `pv_logged:${providerId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    (supabase.rpc as any)('log_provider_public_event', {
      provider_id: providerId,
      event_action: 'profile_view',
      page_path: window.location.pathname,
      source_marker: getLeadSource(),
    }).then(() => {});
  } catch { /* silent */ }
};

interface PageSettings {
  sections_order: string[];
  hidden_sections: string[];
  headline: string;
  tagline: string;
  cta_text: string;
  cta_whatsapp_text: string;
  accent_color: string;
  cover_image_url: string;
  instagram_url: string;
  facebook_url: string;
  youtube_url: string;
  tiktok_url: string;
  theme: string;
}

const DEFAULT_SETTINGS: PageSettings = {
  sections_order: ['about', 'portfolio', 'services', 'reviews'],
  hidden_sections: [],
  headline: '',
  tagline: '',
  cta_text: 'Solicitar Orçamento',
  cta_whatsapp_text: 'Chamar no WhatsApp',
  accent_color: '',
  cover_image_url: '',
  instagram_url: '',
  facebook_url: '',
  youtube_url: '',
  tiktok_url: '',
  theme: 'default',
};

interface ThemeConfig {
  card: string;
  section: string;
  page: string;
  heading: string;
  button: string;
  buttonOutline: string;
  fontBody: string;
  fontHeading: string;
  badge: string;
  input: string;
}

interface PortfolioAlbum {
  id: string;
  name: string;
  description: string;
  photos: { id: string; image_url: string; display_order: number }[];
}

interface ProviderProfileSnapshot {
  provider: any;
  services: any[];
  reviews: any[];
  portfolioImages: string[];
  portfolioRawUrls: string[];
  portfolioAlbums: PortfolioAlbum[];
  pageSettings: PageSettings;
  relatedProviders: any[];
}

const PROVIDER_PROFILE_CACHE_TTL = 1000 * 60 * 15;
const providerProfileCache = new Map<string, { ts: number; snapshot: ProviderProfileSnapshot }>();

const THEME_CLASSES: Record<string, ThemeConfig> = {
  default: {
    card: 'rounded-xl border border-border bg-card shadow-card',
    section: 'rounded-xl border border-border bg-card p-6 shadow-card',
    page: '',
    heading: 'font-display',
    button: 'rounded-md',
    buttonOutline: 'rounded-md border border-input',
    fontBody: 'font-sans',
    fontHeading: "font-['Plus_Jakarta_Sans']",
    badge: 'rounded-full',
    input: 'rounded-md border border-input',
  },
  moderno: {
    card: 'rounded-2xl border-0 bg-gradient-to-br from-card to-accent/5 shadow-lg',
    section: 'rounded-2xl border-0 bg-gradient-to-br from-card to-accent/5 p-6 shadow-lg',
    page: 'bg-gradient-to-b from-background to-accent/5',
    heading: "font-['Space_Grotesk'] tracking-tight",
    button: 'rounded-xl shadow-lg',
    buttonOutline: 'rounded-xl border-2 border-primary/20',
    fontBody: "font-['DM_Sans']",
    fontHeading: "font-['Space_Grotesk']",
    badge: 'rounded-xl',
    input: 'rounded-xl border-0 bg-muted/50 shadow-inner',
  },
  classico: {
    card: 'rounded-lg border-2 border-amber-200/60 bg-amber-50/30 shadow-sm',
    section: 'rounded-lg border-2 border-amber-200/60 bg-amber-50/30 p-6 shadow-sm',
    page: 'bg-amber-50/20',
    heading: "font-['Playfair_Display'] italic",
    button: 'rounded-lg border-2',
    buttonOutline: 'rounded-lg border-2 border-amber-300/60',
    fontBody: "font-['DM_Sans']",
    fontHeading: "font-['Playfair_Display']",
    badge: 'rounded-lg border border-amber-200/60',
    input: 'rounded-lg border-2 border-amber-200/40',
  },
  minimalista: {
    card: 'rounded-none border-0 border-b border-border/30 bg-transparent shadow-none',
    section: 'rounded-none border-0 border-b border-border/30 bg-transparent p-6 shadow-none',
    page: 'bg-background',
    heading: "font-['Space_Grotesk'] font-light tracking-[0.2em] uppercase text-sm",
    button: 'rounded-none border-b-2 border-foreground bg-transparent text-foreground shadow-none hover:bg-foreground hover:text-background',
    buttonOutline: 'rounded-none border-b border-border/50',
    fontBody: "font-['DM_Sans'] font-light",
    fontHeading: "font-['Space_Grotesk']",
    badge: 'rounded-none border-b border-border/30',
    input: 'rounded-none border-0 border-b border-border/50 bg-transparent',
  },
};

/* ── Animated Counter ── */
const AnimatedNumber = ({ value, duration = 1.5 }: { value: number; duration?: number }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value <= 0) return;
    let start = 0;
    const step = value / (duration * 60);
    const id = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(id); }
      else setDisplay(Math.floor(start));
    }, 1000 / 60);
    return () => clearInterval(id);
  }, [value, duration]);
  return <>{display}</>;
};

/* ── Stat Mini Card ── */
const StatMiniCard = ({ icon: Icon, label, value, delay, accentBg }: { icon: any; label: string; value: string | number; delay: number; accentBg?: string }) => (
  <motion.div
    className="flex flex-col items-center gap-1 rounded-xl bg-accent/5 border border-accent/10 px-3 py-2.5 text-center"
    initial={{ opacity: 0, y: 16, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    whileHover={{ scale: 1.05, y: -2 }}
  >
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10" style={accentBg ? { backgroundColor: `${accentBg}20` } : undefined}>
      <Icon className="h-4 w-4 text-accent" style={accentBg ? { color: accentBg } : undefined} />
    </div>
    <span className="text-lg font-bold text-foreground leading-none">
      {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
    </span>
    <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
  </motion.div>
);

/* ── Trust Badge ── */
const TrustBadge = ({ icon: Icon, text, delay }: { icon: any; text: string; delay: number }) => (
  <motion.span
    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600"
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, type: 'spring', stiffness: 300, damping: 20 }}
  >
    <Icon className="h-3 w-3" />
    {text}
  </motion.span>
);

const ProviderProfile = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const reviewsEnabled = useFeatureEnabled('reviews_enabled');
  const { slug } = useParams();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [portfolioImages, setPortfolioImages] = useState<string[]>([]);
  const [portfolioRawUrls, setPortfolioRawUrls] = useState<string[]>([]);
  const [portfolioAlbums, setPortfolioAlbums] = useState<PortfolioAlbum[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', service: '', message: '' });
  const [pageSettings, setPageSettings] = useState<PageSettings>(DEFAULT_SETTINGS);
  const [relatedProviders, setRelatedProviders] = useState<any[]>([]);
  const [showStickyContact, setShowStickyContact] = useState(false);
  const mainWhatsappRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    const applySnapshot = (snapshot: ProviderProfileSnapshot) => {
      if (!active) return;
      setProvider(snapshot.provider);
      setServices(snapshot.services);
      setReviews(snapshot.reviews);
      setPortfolioRawUrls(snapshot.portfolioRawUrls);
      setPortfolioImages(snapshot.portfolioImages);
      setPortfolioAlbums(snapshot.portfolioAlbums || []);
      setPageSettings(snapshot.pageSettings);
      setRelatedProviders(snapshot.relatedProviders);
      setLoading(false);
    };

    const fetchProvider = async () => {
      if (!slug) {
        if (active) setLoading(false);
        return;
      }

      const cached = providerProfileCache.get(slug);
      if (cached && Date.now() - cached.ts < PROVIDER_PROFILE_CACHE_TTL) {
        applySnapshot(cached.snapshot);
        return;
      }

      if (active) setLoading(true);

      const PROVIDER_PUBLIC_COLS = 'id, user_id, business_name, category_id, category_custom, city, state, neighborhood, description, featured, phone, photo_url, plan, portfolio_album_count, portfolio_photo_count, rating_avg, response_time, review_count, service_radius, services_count, slug, status, whatsapp, working_hours, years_experience, ibge_code, latitude, longitude, created_at, updated_at, deleted_at, onboarding_progress, website, user_ref';

      let { data } = await supabase
        .from('providers')
        .select(`${PROVIDER_PUBLIC_COLS}, categories(name, slug, icon)`)
        .eq('slug', slug)
        .maybeSingle();

      if (!data && slug) {
        const sanitized = sanitizeSlug(slug);
        if (sanitized !== slug) {
          const { data: fallback } = await supabase
            .from('providers')
            .select(`${PROVIDER_PUBLIC_COLS}, categories(name, slug, icon)`)
            .eq('slug', sanitized)
            .maybeSingle();
          if (fallback) {
            navigate(`/profissional/${fallback.slug}`, { replace: true });
            return;
          }
        }
      }

      if (data) {
        let preparedPageSettings: PageSettings = DEFAULT_SETTINGS;
        let preparedServices: any[] = [];
        let preparedReviews: any[] = [];
        let preparedPortfolioRawUrls: string[] = [];
        let preparedPortfolioImages: string[] = [];
        let preparedRelated: any[] = [];

        const { data: profile } = await supabase
          .from('public_profiles' as any)
          .select('full_name, avatar_url')
          .eq('id', data.user_id)
          .maybeSingle();

        const { data: userProfile } = await supabase
          .from('profiles')
          .select('level_id, account_type_id')
          .eq('id', data.user_id)
          .maybeSingle();

        let levelInfo: any = null;
        let accTypeInfo: any = null;
        if (userProfile?.level_id) {
          const { data: lv } = await supabase.from('user_levels').select('name, color').eq('id', userProfile.level_id).single();
          levelInfo = lv;
        }
        if (userProfile?.account_type_id) {
          const { data: at } = await supabase.from('account_types').select('name, color').eq('id', userProfile.account_type_id).single();
          accTypeInfo = at;
        }

        const providerWithProfile = { ...data, profiles: profile, levelInfo, accTypeInfo };

        const [{ data: svc }, { data: rev }, { data: ps }] = await Promise.all([
          supabase.from('services').select('*').eq('provider_id', data.id),
          supabase.from('reviews')
            .select('*, user_id')
            .eq('provider_id', data.id)
            .order('created_at', { ascending: false }),
          supabase.from('provider_page_settings').select('*').eq('provider_id', data.id).maybeSingle(),
        ]);

        if (ps) {
          preparedPageSettings = {
            sections_order: (ps.sections_order as string[]) || DEFAULT_SETTINGS.sections_order,
            hidden_sections: (ps.hidden_sections as string[]) || [],
            headline: ps.headline || '',
            tagline: ps.tagline || '',
            cta_text: ps.cta_text || DEFAULT_SETTINGS.cta_text,
            cta_whatsapp_text: ps.cta_whatsapp_text || DEFAULT_SETTINGS.cta_whatsapp_text,
            accent_color: ps.accent_color || '',
            cover_image_url: ps.cover_image_url || '',
            instagram_url: ps.instagram_url || '',
            facebook_url: ps.facebook_url || '',
            youtube_url: ps.youtube_url || '',
            tiktok_url: ps.tiktok_url || '',
            theme: (ps as any).theme || 'default',
          };
        }

        if (svc && svc.length > 0) {
          const svcIds = svc.map((s: any) => s.id);
          const [{ data: scData }, { data: siData }] = await Promise.all([
            supabase.from('service_categories')
              .select('service_id, category_id, categories(name, icon)')
              .in('service_id', svcIds),
            supabase.from('service_images')
              .select('*')
              .in('service_id', svcIds)
              .order('display_order'),
          ]);

          const catMap: Record<string, any[]> = {};
          (scData || []).forEach((sc: any) => {
            if (!catMap[sc.service_id]) catMap[sc.service_id] = [];
            catMap[sc.service_id].push(sc.categories);
          });

          const imgMap: Record<string, any[]> = {};
          (siData || []).forEach((si: any) => {
            if (!imgMap[si.service_id]) imgMap[si.service_id] = [];
            imgMap[si.service_id].push(si);
          });

          preparedServices = svc.map((s: any) => ({
            ...s,
            serviceCategories: catMap[s.id] || [],
            serviceImages: imgMap[s.id] || [],
          }));
        }

        if (rev && rev.length > 0) {
          const reviewUserIds = [...new Set(rev.map((r: any) => r.user_id))];
          const { data: reviewProfiles } = await supabase
            .from('public_profiles' as any)
            .select('id, full_name')
            .in('id', reviewUserIds);
          const profileMap: Record<string, string> = {};
          (reviewProfiles || []).forEach((p: any) => { profileMap[p.id] = p.full_name; });
          preparedReviews = rev.map((r: any) => ({ ...r, profiles: { full_name: profileMap[r.user_id] || 'Cliente' } }));
        }

        // Fetch portfolio: try albums first, fallback to legacy storage
        let preparedAlbums: PortfolioAlbum[] = [];
        const { data: albumsData } = await supabase
          .from('portfolio_albums')
          .select('id, name, description')
          .eq('provider_id', data.id)
          .order('display_order');

        if (albumsData && albumsData.length > 0) {
          const albumIds = albumsData.map(a => a.id);
          const { data: photosData } = await supabase
            .from('portfolio_photos')
            .select('id, album_id, image_url, display_order')
            .in('album_id', albumIds)
            .order('display_order');

          preparedAlbums = albumsData.map(album => ({
            ...album,
            photos: (photosData || []).filter(p => p.album_id === album.id),
          }));

          // Flatten all photos for lightbox compatibility
          const allPhotos = preparedAlbums.flatMap(a => a.photos);
          preparedPortfolioRawUrls = allPhotos.map(p => p.image_url);
          preparedPortfolioImages = preparedPortfolioRawUrls.map(u => isVideoUrl(u) ? u : portfolioThumb(u));
        } else {
          // Fallback: legacy flat storage for old profiles
          const { data: files } = await supabase.storage.from('portfolio').list(`${data.user_id}`, { limit: 20 });
          if (files) {
            const filtered = files.filter(f => f.name !== '.emptyFolderPlaceholder');
            preparedPortfolioRawUrls = filtered.map(f => supabase.storage.from('portfolio').getPublicUrl(`${data.user_id}/${f.name}`).data.publicUrl);
            preparedPortfolioImages = preparedPortfolioRawUrls.map(u => isVideoUrl(u) ? u : portfolioThumb(u));
          }
        }

        // Fetch related providers — prioritize same category, then same city
        try {
          let relatedQuery = supabase
            .from('providers')
            .select('id, slug, business_name, city, state, photo_url, rating_avg, review_count, user_id, category_id, categories(name, icon)')
            .neq('id', data.id)
            .eq('status', 'approved')
            .is('deleted_at', null)
            .order('rating_avg', { ascending: false })
            .limit(6);

          if (data.category_id) {
            relatedQuery = relatedQuery.eq('category_id', data.category_id);
          } else if (data.city) {
            relatedQuery = relatedQuery.eq('city', data.city);
          }

          const { data: related } = await relatedQuery;

          if (related && related.length > 0) {
            const relUserIds = related.map((r: any) => r.user_id);
            const { data: relProfiles } = await supabase
              .from('public_profiles' as any)
              .select('id, full_name, avatar_url')
              .in('id', relUserIds);
            const pMap: Record<string, any> = {};
            (relProfiles || []).forEach((p: any) => { pMap[p.id] = p; });
            preparedRelated = related.map((r: any) => ({ ...r, profiles: pMap[r.user_id] || null }));
          }
        } catch {
          // silently ignore
        }

        const snapshot: ProviderProfileSnapshot = {
          provider: providerWithProfile,
          services: preparedServices,
          reviews: preparedReviews,
          portfolioImages: preparedPortfolioImages,
          portfolioRawUrls: preparedPortfolioRawUrls,
          portfolioAlbums: preparedAlbums,
          pageSettings: preparedPageSettings,
          relatedProviders: preparedRelated,
        };

        providerProfileCache.set(slug, { ts: Date.now(), snapshot });
        applySnapshot(snapshot);
        return;
      }

      if (active) {
        setProvider(null);
        setServices([]);
        setReviews([]);
        setPortfolioImages([]);
        setPortfolioRawUrls([]);
        setPageSettings(DEFAULT_SETTINGS);
        setRelatedProviders([]);
        setLoading(false);
      }
    };

    fetchProvider();
    return () => { active = false; };
  }, [slug, navigate]);

  // ── Realtime sync for provider stats ──
  useEffect(() => {
    if (!provider?.id) return;
    // Track a profile_view (debounced via sessionStorage in the helper)
    trackProfileView(provider.id);
    const channel = supabase
      .channel(`profile-realtime-${provider.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'providers',
        filter: `id=eq.${provider.id}`,
      }, (payload) => {
        setProvider((prev: any) => prev ? { ...prev, ...payload.new } : prev);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'reviews',
        filter: `provider_id=eq.${provider.id}`,
      }, (payload) => {
        setReviews((prev) => [payload.new as any, ...prev]);
        setProvider((prev: any) => prev ? { ...prev, review_count: (prev.review_count || 0) + 1 } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider?.id]);

  useEffect(() => {
    const currentWhatsApp = toCanonical(provider?.whatsapp || provider?.phone || '');
    if (!isMobile || !currentWhatsApp) {
      setShowStickyContact(false);
      return;
    }

    const target = mainWhatsappRef.current;
    if (!target) {
      setShowStickyContact(false);
      return;
    }

    let frame = 0;
    let safeAreaBottom = 0;
    let lastShouldShow: boolean | null = null;
    const getSafeAreaBottom = () => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;bottom:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none;';
      document.body.appendChild(probe);
      const value = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
      probe.remove();
      return value;
    };

    const measureVisibility = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
        const visibleHeight = Math.min(rect.bottom, viewportHeight - safeAreaBottom) - Math.max(rect.top, 0);
        const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
        const shouldShow = !(visibleHeight > 8 && visibleWidth > 8);
        if (shouldShow !== lastShouldShow) {
          lastShouldShow = shouldShow;
          setShowStickyContact(shouldShow);
        }
      });
    };
    const updateSafeAreaAndVisibility = () => {
      safeAreaBottom = getSafeAreaBottom();
      measureVisibility();
    };

    const observer = new IntersectionObserver(
      () => measureVisibility(),
      { threshold: [0, 0.01, 0.1, 1] },
    );
    const resizeObserver = new ResizeObserver(measureVisibility);

    observer.observe(target);
    resizeObserver.observe(target);
    resizeObserver.observe(document.body);
    window.addEventListener('scroll', measureVisibility, { passive: true });
    window.addEventListener('resize', updateSafeAreaAndVisibility);
    window.visualViewport?.addEventListener('resize', updateSafeAreaAndVisibility);
    window.visualViewport?.addEventListener('scroll', measureVisibility);
    updateSafeAreaAndVisibility();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('scroll', measureVisibility);
      window.removeEventListener('resize', updateSafeAreaAndVisibility);
      window.visualViewport?.removeEventListener('resize', updateSafeAreaAndVisibility);
      window.visualViewport?.removeEventListener('scroll', measureVisibility);
    };
  }, [isMobile, provider?.whatsapp, provider?.phone]);

  // DESTAQUE criteria
  const destaqueRequireAvatar = useSettingValue('destaque_require_avatar') !== 'false';
  const destaqueRequirePortfolio = useSettingValue('destaque_require_portfolio') !== 'false';
  const destaqueRequireServices = useSettingValue('destaque_require_services') !== 'false';
  const destaqueMinServices = Number(useSettingValue('destaque_min_services')) || 1;
  const destaqueMinPortfolio = Number(useSettingValue('destaque_min_portfolio')) || 1;
  const avatarFallbackStyle = useSettingValue('avatar_fallback_style') || 'adventurer';

  const name = provider ? capitalizeName((provider.profiles as any)?.full_name || provider.business_name || 'Profissional') : '';
  const hasOwnAvatar = !!(provider && ((provider.profiles as any)?.avatar_url || provider.photo_url));
  const diceBearAvatar = provider ? `https://api.dicebear.com/9.x/${avatarFallbackStyle}/svg?seed=${encodeURIComponent(provider.user_id || provider.id)}` : '';
  const avatarUrl = provider ? (hasOwnAvatar ? avatarLarge((provider.profiles as any)?.avatar_url || provider.photo_url) : diceBearAvatar) : '';
  const category = provider ? ((provider.categories as any)?.name || '') : '';
  const categorySlug = provider ? ((provider.categories as any)?.slug || '') : '';
  const categoryIcon = provider ? ((provider.categories as any)?.icon || '') : '';
  const initials = name ? name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : '';

  // DESTAQUE: based on profile completeness (no longer requires legacy 'premium' plan)
  const isDestaque = !!provider && (
    hasOwnAvatar ||
    (provider.services_count || 0) >= (destaqueMinServices || 1) ||
    (provider.portfolio_album_count || 0) > 0 ||
    !!(provider.description && provider.description.trim())
  );
  const effectiveWhatsApp = provider ? toCanonical(provider.whatsapp || provider.phone || '') : '';
  const hasSocial = pageSettings.instagram_url || pageSettings.facebook_url || pageSettings.youtube_url || pageSettings.tiktok_url;

  useSeoHead({
    title: provider ? `${name} - ${category} em ${provider.city} | Preciso de um` : 'Profissional',
    description: provider
      ? `${name}, ${category} em ${provider.city}-${provider.state}. ${provider.review_count} avaliacoes, nota ${Number(provider.rating_avg).toFixed(1)}. ${provider.levelInfo?.name ? `Nivel ${provider.levelInfo.name}.` : ''} Peca seu orcamento gratis!`
      : 'Encontre profissionais na plataforma.',
    canonical: slug ? `${SITE_BASE_URL}/profissional/${slug}` : undefined,
    ogImage: provider && hasOwnAvatar ? ((provider.profiles as any)?.avatar_url || provider.photo_url || undefined) : undefined,
    ogType: 'profile',
  });

  const breadcrumbLd = useMemo(() => provider ? ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_BASE_URL}/` },
      ...(categorySlug ? [{ '@type': 'ListItem', position: 2, name: category, item: `${SITE_BASE_URL}/categoria/${categorySlug}` }] : []),
      { '@type': 'ListItem', position: categorySlug ? 3 : 2, name },
    ],
  }) : null, [provider, name, category, categorySlug]);

  const localBusinessLd = useMemo(() => {
    if (!provider) return null;
    const sameAs = [
      pageSettings.instagram_url,
      pageSettings.facebook_url,
      pageSettings.youtube_url,
      pageSettings.tiktok_url,
    ].filter(Boolean) as string[];

    return {
      '@context': 'https://schema.org',
      // ProfessionalService is a more specific subtype of LocalBusiness — better for SEO of service providers.
      '@type': ['ProfessionalService', 'LocalBusiness'],
      '@id': `${SITE_BASE_URL}/profissional/${slug}`,
      name: provider.business_name || name,
      description: provider.description || `${name}, ${category} em ${provider.city}-${provider.state}.`,
      image: avatarUrl || undefined,
      url: `${SITE_BASE_URL}/profissional/${slug}`,
      telephone: effectiveWhatsApp || provider.phone || undefined,
      priceRange: '$$',
      address: {
        '@type': 'PostalAddress',
        addressLocality: provider.city,
        addressRegion: provider.state,
        addressCountry: 'BR',
      },
      ...(provider.latitude && provider.longitude
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: Number(provider.latitude),
              longitude: Number(provider.longitude),
            },
          }
        : {}),
      ...(provider.city
        ? {
            areaServed: {
              '@type': 'City',
              name: provider.city,
              containedInPlace: { '@type': 'AdministrativeArea', name: provider.state },
            },
          }
        : {}),
      ...(category ? { serviceType: category } : {}),
      ...(provider.review_count > 0
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: Number(provider.rating_avg).toFixed(1),
              reviewCount: provider.review_count,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
      ...(sameAs.length > 0 ? { sameAs } : {}),
    };
  }, [provider, name, category, avatarUrl, slug, effectiveWhatsApp, pageSettings.instagram_url, pageSettings.facebook_url, pageSettings.youtube_url, pageSettings.tiktok_url]);

  useJsonLd(breadcrumbLd);
  useJsonLd(localBusinessLd);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('leads').insert({
      provider_id: provider.id,
      client_name: leadForm.name,
      phone: leadForm.phone,
      service_needed: leadForm.service,
      message: leadForm.message,
    });
    if (error) {
      toast.error('Erro ao enviar solicitação');
      return;
    }
    setLeadSent(true);
    toast.success('Solicitação enviada com sucesso!');
  };

  const openPortfolioLightbox = (index: number) => {
    setLightboxImages(portfolioRawUrls);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const openServiceLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } };
  const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
  const scaleIn = { hidden: { opacity: 0, scale: 0.92 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } };
  const slideInLeft = { hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } };

  // 'Verificado' badge removed — replaced by Engagement Tier ranking (see ProviderCard)
  const hasProfileImages = !!(provider?.photo_url || portfolioImages.length > 0);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="container py-8 space-y-4">
          <Skeleton className="h-56 rounded-2xl" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="container flex flex-1 items-center justify-center py-20">
          <motion.div
            className="text-center space-y-3"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-foreground">Profissional não encontrado</p>
            <p className="text-sm text-muted-foreground">Verifique o link ou tente buscar novamente.</p>
            <Button variant="outline" asChild>
              <Link to="/buscar">Buscar profissionais</Link>
            </Button>
          </motion.div>
        </div>
        <Footer />
      </div>
    );
  }

  const accentStyle = pageSettings.accent_color
    ? { '--provider-accent': pageSettings.accent_color } as React.CSSProperties
    : {};
  const accentBg = pageSettings.accent_color ? `hsl(${pageSettings.accent_color})` : undefined;
  const citySlug = provider.city?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  const visibleSections = pageSettings.sections_order.filter(s => !pageSettings.hidden_sections.includes(s));
  const tc = THEME_CLASSES[pageSettings.theme] || THEME_CLASSES.default;
  const { requestWhatsApp } = useWhatsAppGate();

  // ── Section renderers ──

  const renderAbout = () => (
    <motion.div key="about" className={`mt-6 ${tc.section} overflow-hidden`} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
          <Briefcase className="h-4 w-4 text-accent" />
        </div>
        <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>Sobre o profissional</h2>
      </div>
      <motion.p
        className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line"
        variants={slideInLeft}
      >
        {provider.description && !/cadastrado na plataforma|entre em contato para mais informa/i.test(provider.description) ? provider.description : 'Este profissional ainda não adicionou uma descrição.'}
      </motion.p>

      {/* Info grid */}
      <motion.div
        className="mt-5 grid grid-cols-2 gap-3"
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {provider.city && (
          <motion.div variants={scaleIn} className="flex items-center gap-2.5 rounded-lg bg-muted/40 p-3">
            <MapPin className="h-4 w-4 text-accent shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Localização</p>
              <p className="text-xs font-medium text-foreground">{provider.city} - {provider.state}</p>
            </div>
          </motion.div>
        )}
        {provider.neighborhood && (
          <motion.div variants={scaleIn} className="flex items-center gap-2.5 rounded-lg bg-muted/40 p-3">
            <MapPin className="h-4 w-4 text-accent shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Bairro</p>
              <p className="text-xs font-medium text-foreground">{provider.neighborhood}</p>
            </div>
          </motion.div>
        )}
        {provider.working_hours && (
          <motion.div variants={scaleIn} className="flex items-center gap-2.5 rounded-lg bg-muted/40 p-3">
            <Clock className="h-4 w-4 text-accent shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Horário</p>
              <p className="text-xs font-medium text-foreground">{provider.working_hours}</p>
            </div>
          </motion.div>
        )}
        {provider.service_radius && (
          <motion.div variants={scaleIn} className="flex items-center gap-2.5 rounded-lg bg-muted/40 p-3">
            <Zap className="h-4 w-4 text-accent shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Raio de Atuação</p>
              <p className="text-xs font-medium text-foreground">{provider.service_radius}</p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );

  const renderPortfolio = () => {
    if (portfolioImages.length === 0) return null;

    // If we have albums, render organized by album
    if (portfolioAlbums.length > 0) {
      let globalIndex = 0;
      return (
        <motion.div key="portfolio" className={`mt-6 ${tc.section} overflow-hidden`} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <ImageIcon className="h-4 w-4 text-accent" />
            </div>
            <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>Trabalhos Realizados</h2>
            <motion.span
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent"
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }}
            >
              <ImageIcon className="h-3 w-3" />
              {portfolioAlbums.length} {portfolioAlbums.length === 1 ? 'álbum' : 'álbuns'} • {portfolioImages.length} fotos
            </motion.span>
          </div>
          <div className="space-y-5">
            {portfolioAlbums.filter(a => a.photos.length > 0).map(album => {
              const albumPhotos = album.photos.map(p => isVideoUrl(p.image_url) ? p.image_url : portfolioThumb(p.image_url));
              const showCount = isMobile ? 3 : 4;
              const visible = albumPhotos.slice(0, showCount);
              const remaining = albumPhotos.length - showCount;
              const startIdx = globalIndex;
              globalIndex += album.photos.length;

              return (
                <div key={album.id}>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{album.name}</h3>
                  {album.description && <p className="text-xs text-muted-foreground mb-2">{album.description}</p>}
                  <motion.div className="grid grid-cols-2 gap-2 sm:grid-cols-4" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                    {visible.map((url, i) => (
                      <motion.div
                        key={i}
                        variants={scaleIn}
                        className="relative cursor-pointer overflow-hidden rounded-xl border border-border group aspect-square"
                        onClick={() => openPortfolioLightbox(startIdx + i)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {isVideoUrl(url) ? (
                          <>
                            <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover transition-all duration-700 group-hover:scale-110" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="h-10 w-10 rounded-full bg-black/60 flex items-center justify-center">
                                <Play className="h-5 w-5 text-white fill-white" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <img src={url} alt={`${album.name} ${i + 1}`} className="h-full w-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110" loading="lazy" onError={handleImageError} />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <motion.div className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" whileHover={{ scale: 1.1 }}>
                          <Eye className="h-3.5 w-3.5" />
                        </motion.div>
                        {i === showCount - 1 && remaining > 0 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                            <span className="text-white text-lg font-bold">+{remaining}</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              );
            })}
          </div>
        </motion.div>
      );
    }

    // Fallback: flat grid (legacy storage)
    const showCount = isMobile ? 4 : 6;
    const visiblePhotos = portfolioImages.slice(0, showCount);
    const remaining = portfolioImages.length - showCount;

    return (
      <motion.div key="portfolio" className={`mt-6 ${tc.section} overflow-hidden`} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <ImageIcon className="h-4 w-4 text-accent" />
          </div>
          <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>Trabalhos Realizados</h2>
          <motion.span
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }}
          >
            <ImageIcon className="h-3 w-3" />
            {portfolioImages.length} fotos
          </motion.span>
        </div>
        <motion.div className="grid grid-cols-2 gap-2 sm:grid-cols-3" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          {visiblePhotos.map((url, i) => (
            <motion.div
              key={i}
              variants={scaleIn}
              className={`relative cursor-pointer overflow-hidden rounded-xl border border-border group ${i === 0 ? 'col-span-2 row-span-2 aspect-[4/3]' : 'aspect-square'}`}
              onClick={() => openPortfolioLightbox(i)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isVideoUrl(url) ? (
                <>
                  <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover transition-all duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-10 w-10 rounded-full bg-black/60 flex items-center justify-center">
                      <Play className="h-5 w-5 text-white fill-white" />
                    </div>
                  </div>
                </>
              ) : (
                <img src={url} alt={`Trabalho ${i + 1}`} className="h-full w-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110" loading="lazy" onError={handleImageError} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <motion.div
                className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                whileHover={{ scale: 1.1 }}
              >
                <Eye className="h-3.5 w-3.5" />
              </motion.div>
              {i === showCount - 1 && remaining > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                  <span className="text-white text-lg font-bold">+{remaining}</span>
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    );
  };

  const renderServices = () => (
    <ServicesList
      key="services"
      services={services}
      whatsapp={effectiveWhatsApp}
      providerName={name}
      providerCity={provider.city}
      ctaWhatsappText={pageSettings.cta_whatsapp_text}
      accentBg={accentBg}
      themeClasses={tc}
      onImageClick={openServiceLightbox}
      providerId={provider.id}
    />
  );

  const renderReviews = () => {
    if (!reviewsEnabled) return null;
    const avgRating = Number(provider.rating_avg) || 0;
    return (
      <motion.div key="reviews" className={`mt-6 ${tc.section} overflow-hidden`} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <Star className="h-4 w-4 text-accent" />
          </div>
          <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>Avaliações</h2>
          {reviews.length > 0 && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
              <Star className="h-3 w-3 fill-accent" />
              {avgRating.toFixed(1)} ({reviews.length})
            </span>
          )}
        </div>

        {reviews.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Star className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Nenhuma avaliação ainda.</p>
          </div>
        ) : (
          <motion.div className="mt-2 space-y-4" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {reviews.map((r) => (
              <motion.div key={r.id} className="rounded-lg border border-border/50 p-4 hover:border-accent/20 transition-colors" variants={fadeUp}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">
                      {((r.profiles as any)?.full_name || 'C')[0]}
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {(r.profiles as any)?.full_name || 'Cliente'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="mt-2">
                  <StarRating rating={r.rating} showValue={false} size={14} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{r.comment}</p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    );
  };

  const renderTestimonials = () => (
    <TestimonialsCarousel reviews={reviews} />
  );

  const renderAboutWithGuarantee = () => (
    <>
      {renderAbout()}
      <TrustGuarantee />
    </>
  );

  const sectionMap: Record<string, () => React.ReactNode> = {
    about: renderAboutWithGuarantee,
    portfolio: renderPortfolio,
    services: renderServices,
    reviews: renderReviews,
    testimonials: renderTestimonials,
  };

  return (
    <div className={`flex min-h-screen flex-col ${tc.page} ${tc.fontBody}`} style={accentStyle}>
      <Header />

      {/* Cover Image Hero */}
      {pageSettings.cover_image_url && (
        <motion.div
          className="relative w-full aspect-[16/5] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <motion.img
            src={coverImage(pageSettings.cover_image_url)}
            alt="Capa"
            className="h-full w-full object-cover"
            loading="eager"
            onError={handleImageError}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 container pb-6 text-white">
            {pageSettings.headline && <h2 className="font-display text-xl sm:text-3xl font-bold drop-shadow-lg">{pageSettings.headline}</h2>}
            {pageSettings.tagline && <p className="mt-1 text-sm sm:text-lg opacity-90 drop-shadow">{pageSettings.tagline}</p>}
          </div>
        </motion.div>
      )}

      {!pageSettings.cover_image_url && (pageSettings.headline || pageSettings.tagline) && (
        <div className="container pt-6">
          {pageSettings.headline && <h2 className="font-display text-xl font-bold text-foreground line-clamp-2">{pageSettings.headline}</h2>}
          {pageSettings.tagline && <p className="mt-1 text-sm text-muted-foreground">{pageSettings.tagline}</p>}
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="container py-3 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
        {categorySlug && (
          <>
            <ChevronRight className="mx-1 inline h-3 w-3" />
            <Link to={`/categoria/${categorySlug}`} className="hover:text-foreground transition-colors">{category}</Link>
          </>
        )}
        {provider.city && (
          <>
            <ChevronRight className="mx-1 inline h-3 w-3" />
            <Link to={`/cidade/${citySlug}`} className="hover:text-foreground transition-colors">{provider.city}</Link>
          </>
        )}
        <ChevronRight className="mx-1 inline h-3 w-3" />
        <span className="text-foreground font-medium">{name}</span>
      </nav>

      <Suspense fallback={null}><AdSlot slotSlug="profile-top" category={category} city={provider.city} state={provider.state} /></Suspense>

      <div className="container py-6">
        <div className="mx-auto max-w-3xl">
          {/* ── Profile Header Card ── */}
          <motion.div
            className={`p-6 ${tc.card} overflow-hidden relative`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Subtle gradient background accent */}
            <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-accent/5 blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="relative flex flex-col items-center text-center gap-4 sm:flex-row sm:items-start sm:text-left">
              <motion.div
                className="relative"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <Avatar className="h-28 w-28 shrink-0 rounded-2xl ring-4 ring-accent/20 shadow-xl">
                  <AvatarImage src={avatarUrl || undefined} alt={name} className="rounded-2xl" />
                  <AvatarFallback className="rounded-2xl bg-primary text-3xl font-bold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {/* Online indicator pulse */}
                <motion.div
                  className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-card"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              </motion.div>
              <motion.div
                className="flex-1 min-w-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25, duration: 0.5 }}
              >
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h1 className="font-display text-2xl font-bold text-foreground">{name}</h1>
                  {isDestaque && (
                    <motion.span
                      className={`inline-flex items-center gap-1 ${tc.badge} border-2 border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent`}
                      initial={{ scale: 0, rotate: -12 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 15 }}
                    >
                      <Crown className="h-3 w-3" strokeWidth={1.75} /> DESTAQUE
                    </motion.span>
                  )}
                  {/* Smart label: Empresa (CNPJ) or Prestador, never Administrador */}
                  {(() => {
                    const accName = provider.accTypeInfo?.name || '';
                    const isAdminLabel = accName.toLowerCase().includes('admin');
                    if (isAdminLabel) return null;
                    const hasCnpj = !!(provider as any).cnpj;
                    const labelText = hasCnpj ? 'Empresa' : 'Prestador';
                    const LabelIcon = hasCnpj ? Building2 : Wrench;
                    const labelColor = hasCnpj ? '#6366f1' : (provider.accTypeInfo?.color || 'hsl(var(--accent))');
                    return (
                      <span className={`inline-flex items-center gap-1 ${tc.badge} border px-2 py-0.5 text-xs font-medium`} style={{ borderColor: `${labelColor}40`, color: labelColor }}>
                        <LabelIcon className="h-3 w-3" strokeWidth={1.75} />
                        {labelText}
                      </span>
                    );
                  })()}
                </div>

                {/* ── PROMINENT LEVEL BADGE (Metallic Design) — hidden for admins and generic "Usuário" level ── */}
                {provider.levelInfo && !(provider.accTypeInfo?.name || '').toLowerCase().includes('admin') && !['usuário', 'usuario', 'user'].includes((provider.levelInfo.name || '').toLowerCase()) && (
                  <div className="mt-2 flex justify-center sm:justify-start">
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex items-center gap-1.5" aria-label={`Profissional Nível ${provider.levelInfo.name}`}>
                            <GamificationLevelBadge
                              levelName={provider.levelInfo.name}
                              levelColor={provider.levelInfo.color}
                              size="lg"
                              showShine={true}
                            />
                            <Info className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs text-center">
                          Este profissional atingiu o nível máximo de completude e engajamento na plataforma.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}

                {/* ── MURAL DE VITRINES (Social Proof) ── */}
                <PublicAchievementsStrip
                  userId={provider.user_id}
                  servicesCount={services.length}
                  portfolioPhotoCount={Number(provider.portfolio_photo_count || 0)}
                  ratingAvg={Number(provider.rating_avg || 0)}
                  reviewCount={Number(provider.review_count || 0)}
                  city={provider.city}
                  state={provider.state}
                  levelName={provider.levelInfo?.name ?? null}
                />
                {provider.business_name && <p className="text-sm text-muted-foreground mt-1">{provider.business_name}</p>}
                <p className="mt-1 text-sm font-semibold flex items-center justify-center sm:justify-start gap-1" style={accentBg ? { color: accentBg } : undefined}>
                  <CategoryIcon icon={categoryIcon} size={16} className="text-accent" />
                  {category || 'Categoria não informada'}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-accent" />
                    {provider.city
                      ? formatLocationString(`${provider.neighborhood ? `${provider.neighborhood}, ` : ''}${provider.city} - ${provider.state}`)
                      : 'Localização não informada'}
                  </span>
                </div>

                {/* Experience & Projects Highlight */}
                {(provider.years_experience > 0 || provider.portfolio_photo_count > 0) && (
                  <motion.div
                    className="mt-2.5 flex flex-wrap items-center justify-center sm:justify-start gap-3"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    {provider.years_experience > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/20 px-3 py-1.5 text-xs font-semibold text-accent">
                        <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {provider.years_experience}+ anos de experiência
                      </span>
                    )}
                    {provider.portfolio_photo_count > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/20 px-3 py-1.5 text-xs font-semibold text-accent">
                        <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {provider.portfolio_photo_count} projetos realizados
                      </span>
                    )}
                  </motion.div>
                )}
                {reviewsEnabled && (
                  <div className="mt-3 flex justify-center sm:justify-start">
                    <ReviewSummary rating={Number(provider.rating_avg)} reviewCount={provider.review_count} />
                  </div>
                )}

                {/* Trust Badges */}
                <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-1.5">
                  <ProfileBadge hasPhoto={hasOwnAvatar} hasServices={services.length > 0} />
                  {provider.years_experience >= 3 && <TrustBadge icon={Award} text="Experiente" delay={0.6} />}
                  {provider.response_time && (
                    <motion.span
                      className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-600"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.8, type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      <Zap className="h-3 w-3" />
                      Responde em {provider.response_time}
                    </motion.span>
                  )}
                </div>

                {hasSocial && (
                  <div className="mt-3 flex justify-center sm:justify-start gap-2">
                    {pageSettings.instagram_url && (
                      <motion.a href={pageSettings.instagram_url} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-all" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                        <Instagram className="h-4 w-4" />
                      </motion.a>
                    )}
                    {pageSettings.facebook_url && (
                      <motion.a href={pageSettings.facebook_url} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-all" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                        <Facebook className="h-4 w-4" />
                      </motion.a>
                    )}
                    {pageSettings.youtube_url && (
                      <motion.a href={pageSettings.youtube_url} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-all" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                        <Youtube className="h-4 w-4" />
                      </motion.a>
                    )}
                     {pageSettings.tiktok_url && (
                      <motion.a href={pageSettings.tiktok_url} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-all" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                        <Music className="h-4 w-4" />
                      </motion.a>
                    )}
                  </div>
                )}
              </motion.div>
            </div>

            {/* ── Trust Statistics Section ── */}
            <motion.div
              className="mt-5 rounded-xl bg-gradient-to-r from-emerald-500/5 via-accent/5 to-blue-500/5 border border-border/50 p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Shield className="h-3 w-3" strokeWidth={1.75} /> Estatísticas de Confiança
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-xl font-extrabold text-foreground leading-none">
                    {provider.years_experience > 0 ? `${provider.years_experience}+` : '—'}
                  </p>
                  <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider">Anos exp.</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-extrabold text-foreground leading-none">{services.length}</p>
                  <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider">Serviços</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-extrabold text-foreground leading-none">{provider.review_count || 0}</p>
                  <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider">Avaliações</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-extrabold text-foreground leading-none">{portfolioImages.length}</p>
                  <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider">Fotos</p>
                </div>
              </div>
            </motion.div>

            {/* ── Stats Mini Cards ── */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {provider.years_experience > 0 && (
                <StatMiniCard icon={Briefcase} label="Experiência" value={`${provider.years_experience}+`} delay={0.4} accentBg={accentBg} />
              )}
              {provider.review_count > 0 && (
                <StatMiniCard icon={Star} label="Avaliações" value={provider.review_count} delay={0.5} accentBg={accentBg} />
              )}
              {services.length > 0 && (
                <StatMiniCard icon={Briefcase} label="Serviços" value={services.length} delay={0.6} accentBg={accentBg} />
              )}
              {portfolioImages.length > 0 && !(provider.years_experience > 0 && provider.review_count > 0 && services.length > 0) && (
                <StatMiniCard icon={ImageIcon} label="Fotos" value={portfolioImages.length} delay={0.6} accentBg={accentBg} />
              )}
            </div>

            {/* ── Conversion Tags ── */}
            <ConversionTags reviewCount={provider.review_count} responseTime={provider.response_time} />

            {/* ── CTA Buttons ── */}
            <motion.div
              className="mt-6 flex flex-col sm:flex-row flex-wrap justify-center sm:justify-start gap-2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  variant="accent"
                  size="lg"
                  className={`${tc.button} gap-2 shadow-lg hover:shadow-xl transition-all w-full sm:w-auto`}
                  onClick={() => setLeadDialogOpen(true)}
                >
                  <Send className="h-4 w-4" />
                  {pageSettings.cta_text}
                </Button>
              </motion.div>
              {effectiveWhatsApp && (
                <motion.div ref={mainWhatsappRef} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    size="lg"
                    className="gap-2 w-full sm:w-auto bg-[#25D366] text-white hover:bg-[#1ebe5a] shadow-lg hover:shadow-xl transition-all"
                    onClick={() => {
                      if (provider) trackContactClick(provider.id, 'whatsapp', window.location.pathname, undefined, 'principal');
                      requestWhatsApp({
                        url: whatsappLink(effectiveWhatsApp, `Olá! Vi seu perfil "${name}" no Preciso de um e gostaria de um orçamento.`),
                        targetType: 'provider',
                        targetId: provider?.id ?? null,
                        targetLabel: name,
                        whatsappNumber: effectiveWhatsApp,
                      });
                    }}
                  >
                    <MessageCircle className="h-5 w-5" /> {pageSettings.cta_whatsapp_text}
                  </Button>
                </motion.div>
              )}
              <div className="flex gap-2 justify-center">
                {isMobile && provider.phone && telLink(provider.phone) && (
                  <Button variant="outline" size="lg" className={tc.buttonOutline}
                    onClick={() => {
                      if (provider) trackContactClick(provider.id, 'phone', window.location.pathname);
                      window.location.href = telLink(provider.phone) || '';
                    }}
                  >
                    <Phone className="h-5 w-5" /> Ligar
                  </Button>
                )}
                <Button variant="ghost" size="lg" onClick={async () => {
                  const profileUrl = window.location.href;
                  const shareTitle = `${name} - ${category} em ${provider.city}`;
                  const shareText = `Veja o perfil de ${name}, ${category} no Preciso de um!`;
                  if (navigator.share) {
                    try {
                      await navigator.share({ title: shareTitle, text: shareText, url: profileUrl });
                    } catch (e) {
                      if ((e as any)?.name !== 'AbortError') {
                        navigator.clipboard.writeText(profileUrl).then(() => toast.success('Link do perfil copiado!'));
                      }
                    }
                  } else {
                    navigator.clipboard.writeText(profileUrl).then(() => toast.success('Link do perfil copiado!')).catch(() => window.prompt('Copie o link:', profileUrl));
                  }
                }}>
                  <Share2 className="h-4 w-4" /> Compartilhar
                </Button>
              </div>
            </motion.div>

            {/* ── Owner: Pedir Avaliação ── */}
            {user?.id === provider.user_id && (
              <motion.div
                className="mt-3 flex flex-col items-center sm:items-start gap-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 border-accent/30 hover:bg-accent/5 w-full sm:w-auto"
                  asChild
                >
                  <a
                    href={whatsappLink('', `Olá! Agradeço por escolher meus serviços. Poderia me avaliar rapidinho na plataforma? Isso fortalece meu trabalho! ${window.location.href}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-wa-skip="true"
                  >
                    <Star className="h-4 w-4 text-accent" /> Pedir Avaliação
                  </a>
                </Button>
                <p className="text-[10px] text-muted-foreground">Envie para clientes recentes via WhatsApp</p>
              </motion.div>
            )}

          </motion.div>

          {/* ── Dynamic sections ── */}
          {visibleSections.map((sectionId) => {
            const render = sectionMap[sectionId];
            return (
              <div key={sectionId}>
                {render ? render() : null}
                {sectionId === 'about' && (
                  <Suspense fallback={null}><AdSlot slotSlug="profile-after-desc" category={category} city={provider.city} state={provider.state} /></Suspense>
                )}
                {sectionId === 'services' && (
                  <Suspense fallback={null}><AdSlot slotSlug="profile-between-services" category={category} city={provider.city} state={provider.state} /></Suspense>
                )}
              </div>
            );
          })}

          {/* ── Testimonials (always rendered if reviews exist) ── */}
          {!visibleSections.includes('testimonials') && reviews.length > 0 && (
            <TestimonialsCarousel reviews={reviews} />
          )}

          {/* ── Related Providers ── */}
          {relatedProviders.length > 0 && (
            <motion.div className="mt-8" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }}>
              <div className="flex items-center gap-2 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                  <Users className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>
                    {category ? `Outros profissionais de ${category}` : 'Profissionais Relacionados'}
                  </h2>
                  <p className="text-xs text-muted-foreground">Veja mais opções na mesma área</p>
                </div>
              </div>
              <motion.div className="grid grid-cols-2 gap-3 sm:grid-cols-3" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                {relatedProviders.map((rp: any) => {
                  const rpName = rp.profiles?.full_name || rp.business_name || 'Profissional';
                  const rpInitials = rpName.split(' ').map((n: string) => n[0]).join('').slice(0, 2);
                  const rpAvatar = avatarLarge(rp.profiles?.avatar_url || rp.photo_url);
                  const rpCategory = (rp.categories as any)?.name || '';
                  const rpCatIcon = (rp.categories as any)?.icon || '';
                  return (
                    <motion.div key={rp.id} variants={scaleIn} whileHover={{ y: -6 }} transition={{ duration: 0.25 }}>
                      <Link
                        to={`/profissional/${rp.slug}`}
                        className={`group block p-4 transition-all hover:shadow-xl hover:border-accent/30 ${tc.card} relative overflow-hidden`}
                      >
                        {/* Subtle gradient on hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        <div className="relative flex flex-col items-center text-center gap-2.5">
                          <div className="relative">
                            <Avatar className="h-16 w-16 rounded-xl ring-2 ring-border group-hover:ring-accent/30 transition-all shadow-md">
                              <AvatarImage src={rpAvatar || undefined} alt={rpName} className="rounded-xl" />
                              <AvatarFallback className="rounded-xl bg-primary/10 text-sm font-bold text-primary">
                                {rpInitials}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          <div className="min-w-0 w-full">
                            <p className="text-sm font-semibold text-foreground truncate">{rpName}</p>
                            {rpCategory && (
                              <p className="text-[11px] text-accent truncate flex items-center justify-center gap-0.5">
                                <CategoryIcon icon={rpCatIcon} size={12} className="text-accent" /> {rpCategory}
                              </p>
                            )}
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              <MapPin className="inline h-3 w-3 mr-0.5" />{rp.city}{rp.state ? ` - ${rp.state}` : ''}
                            </p>
                            {rp.rating_avg > 0 && (
                              <div className="flex items-center justify-center gap-1 mt-1.5">
                                <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                                <span className="text-xs font-semibold text-foreground">{Number(rp.rating_avg).toFixed(1)}</span>
                                {rp.review_count > 0 && (
                                  <span className="text-[10px] text-muted-foreground">({rp.review_count})</span>
                                )}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-accent font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            Ver perfil <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Link to full category */}
              {categorySlug && (
                <motion.div className="mt-4 text-center" variants={fadeUp}>
                  <Link
                    to={`/categoria/${categorySlug}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                  >
                    Ver todos os profissionais de {category}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              )}
            </motion.div>
          )}

          <Suspense fallback={null}><AdSlot slotSlug="profile-before-whatsapp" category={category} city={provider.city} state={provider.state} /></Suspense>
          <Suspense fallback={null}><AdSlot slotSlug="profile-footer" category={category} city={provider.city} state={provider.state} /></Suspense>
        </div>
      </div>

      {/* ── Lead Form Dialog (popup) ── */}
      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                <Send className="h-4 w-4 text-accent" />
              </div>
              {pageSettings.cta_text}
            </DialogTitle>
          </DialogHeader>
          <AnimatePresence mode="wait">
            {leadSent ? (
              <motion.div
                key="success"
                className="rounded-xl bg-accent/10 p-6 text-center space-y-3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <motion.div
                  className="mx-auto h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
                >
                  <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                </motion.div>
                <p className="text-base font-semibold text-foreground">Solicitação enviada!</p>
                <p className="text-sm text-muted-foreground">O profissional entrará em contato em breve.</p>
                <Button variant="outline" onClick={() => setLeadDialogOpen(false)} className="mt-2">Fechar</Button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleLeadSubmit}
                className="space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Seu nome</label>
                  <input type="text" placeholder="Como quer ser chamado?" required value={leadForm.name}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full ${tc.input} bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Telefone</label>
                  <input type="tel" placeholder="(00) 00000-0000" required value={leadForm.phone}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                    className={`w-full ${tc.input} bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Serviço necessário</label>
                  <input type="text" placeholder="Ex: Reforma de banheiro" required value={leadForm.service}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, service: e.target.value }))}
                    className={`w-full ${tc.input} bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Mensagem</label>
                  <textarea placeholder="Descreva o que precisa..." rows={3} value={leadForm.message}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, message: e.target.value }))}
                    className={`w-full ${tc.input} bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none resize-none transition-all`} />
                </div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button type="submit" variant="accent" className="w-full gap-2 shadow-lg" style={accentBg ? { backgroundColor: accentBg } : undefined}>
                    <Send className="h-4 w-4" /> Enviar Solicitação
                  </Button>
                </motion.div>
              </motion.form>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* Sticky CTA bar for mobile */}
      <AnimatePresence initial={false}>
        {effectiveWhatsApp && showStickyContact && (
          <motion.div
            key="sticky-mobile-whatsapp"
            role="navigation"
            aria-label="Ação rápida de contato"
            className="fixed inset-x-0 border-t border-border bg-card/95 p-3 md:hidden shadow-lg backdrop-blur-lg transform-gpu will-change-transform"
            style={{ zIndex: 999, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)' }}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.8 }}
          >
            <span id="sticky-whatsapp-description" className="sr-only">
              Abre uma conversa no WhatsApp com este profissional sem alterar sua posição na página.
            </span>
            <Button
              type="button"
              variant="accent"
              size="lg"
              aria-label={`Chamar ${name} no WhatsApp`}
              aria-describedby="sticky-whatsapp-description"
              className="min-h-12 w-full gap-2 bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={() => {
                if (provider) trackContactClick(provider.id, 'whatsapp', window.location.pathname, undefined, 'sticky');
                requestWhatsApp({
                  url: whatsappLink(effectiveWhatsApp, `Olá! Vi seu perfil "${name}" no Preciso de um e gostaria de um orçamento.`),
                  targetType: 'provider',
                  targetId: provider?.id ?? null,
                  targetLabel: name,
                  whatsappNumber: effectiveWhatsApp,
                });
              }}
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" /> {pageSettings.cta_whatsapp_text}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating WhatsApp — desktop only */}
      {effectiveWhatsApp && (
        <motion.a
          href={whatsappLink(effectiveWhatsApp, `Olá! Vi seu perfil "${name}" no Preciso de um e gostaria de um orçamento.`)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => provider?.id && trackContactClick(provider.id, 'whatsapp', window.location.pathname, undefined, 'flutuante')}
          className="fixed right-4 hidden md:flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg"
          style={{ zIndex: 9999, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
          aria-label="WhatsApp"
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1, type: 'spring', stiffness: 300 }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          <span className="absolute inset-0 rounded-full animate-ping bg-[#25D366]/30 pointer-events-none" style={{ animationDuration: '3s' }} />
        </motion.a>
      )}

      {/* Sponsor ad sidebar slot on profile pages */}
      <div className="container py-4">
        <div className="mx-auto max-w-3xl">
          <Suspense fallback={null}>
            <SponsorAdSlot locationKey="profile-sidebar" layout="card" maxAds={1} />
          </Suspense>
        </div>
      </div>

      <Footer />
      <Suspense fallback={null}>
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      </Suspense>
    </div>
  );
};

/* ── Service Detail Dialog ── */
const ServiceDetailDialog = ({ service, open, onClose, whatsapp, ctaWhatsappText, accentBg, onImageClick, providerId }: { service: any; open: boolean; onClose: () => void; whatsapp: string; ctaWhatsappText?: string; accentBg?: string; onImageClick?: (images: string[], index: number) => void; providerId?: string }) => (
  <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="text-lg font-bold">{service.service_name}</DialogTitle>
      </DialogHeader>
      {service.serviceImages?.length > 0 && (
        <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 md:grid md:grid-cols-2 md:overflow-visible md:snap-none" style={{ touchAction: 'pan-x' }}>
          {service.serviceImages.map((img: any, idx: number) => (
            <motion.div
              key={img.id}
              className="aspect-[4/3] min-w-[75%] flex-shrink-0 snap-center cursor-pointer overflow-hidden rounded-lg border border-border md:min-w-0"
              onClick={() => onImageClick?.(service.serviceImages.map((i: any) => i.image_url), idx)}
              whileHover={{ scale: 1.03 }}
            >
              <img src={serviceImageThumb(img.image_url)} alt="Foto do serviço" className="h-full w-full object-cover" loading="lazy" onError={handleImageError} />
            </motion.div>
          ))}
        </div>
      )}
      {service.serviceCategories?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {service.serviceCategories.map((cat: any, i: number) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
              <CategoryIcon icon={cat.icon} size={12} className="text-accent" /> {cat.name}
            </span>
          ))}
        </div>
      )}
      {service.description && <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>}
      {/* Social links for service */}
      {(service.instagram_url || service.facebook_url || service.youtube_url) && (
        <div className="flex items-center gap-2">
          {service.instagram_url && (
            <a href={service.instagram_url} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-all">
              <Instagram className="h-4 w-4" />
            </a>
          )}
          {service.facebook_url && (
            <a href={service.facebook_url} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-all">
              <Facebook className="h-4 w-4" />
            </a>
          )}
          {service.youtube_url && (
            <a href={service.youtube_url} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-all">
              <Youtube className="h-4 w-4" />
            </a>
          )}
        </div>
      )}
      {/* YouTube embed */}
      {service.youtube_url && isYouTubeUrl(service.youtube_url) && (
        <div className="aspect-video rounded-lg overflow-hidden border border-border">
          <iframe
            src={getYouTubeEmbedUrl(service.youtube_url)}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        {service.price && <span className="inline-flex items-center gap-1 font-semibold text-foreground"><DollarSign className="h-3.5 w-3.5 text-accent" /> {service.price}</span>}
        {service.service_area && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-accent" /> {formatLocationString(service.service_area)}</span>}
        {service.working_hours && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-accent" /> {service.working_hours}</span>}
      </div>
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button variant="accent" className="w-full gap-2" asChild style={accentBg ? { backgroundColor: accentBg } : undefined}>
          <a href={whatsappLink(whatsapp || '', `Olá! Vi o serviço "${service.service_name}" no Preciso de um e gostaria de mais informações.`)} target="_blank" rel="noopener noreferrer" onClick={() => providerId && trackContactClick(providerId, 'whatsapp', window.location.pathname, service.service_name, 'servico')}>
            <MessageCircle className="h-4 w-4" /> {ctaWhatsappText || 'Chamar no WhatsApp'}
          </a>
        </Button>
      </motion.div>
    </DialogContent>
  </Dialog>
);

/* ── Services List with popup ── */
const ServicesList = ({ services, whatsapp, providerName, providerCity, ctaWhatsappText, accentBg, themeClasses, onImageClick, providerId }: { services: any[]; whatsapp: string; providerName: string; providerCity: string; ctaWhatsappText?: string; accentBg?: string; themeClasses?: ThemeConfig; onImageClick?: (images: string[], index: number) => void; providerId?: string }) => {
  const [selected, setSelected] = useState<any | null>(null);
  const tc = themeClasses || THEME_CLASSES.default;

  return (
    <>
      <motion.div className={`mt-6 ${tc.section} overflow-hidden`} variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }} initial="hidden" whileInView="visible" viewport={{ once: true }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <Briefcase className="h-4 w-4 text-accent" />
          </div>
          <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>Serviços oferecidos</h2>
          {services.length > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
              {services.length} {services.length === 1 ? 'serviço' : 'serviços'}
            </span>
          )}
        </div>
        <div className="mt-4 space-y-3">
          {services.map((s: any, idx: number) => (
            <motion.button
              key={s.id}
              onClick={() => setSelected(s)}
              className="w-full text-left rounded-xl border border-border p-4 transition-all hover:border-accent/30 hover:shadow-md group"
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
              whileHover={{ x: 4 }}
            >
              <div className="flex gap-3">
                {s.serviceImages?.length > 0 && (
                  <div className="shrink-0 h-20 w-20 overflow-hidden rounded-lg border border-border shadow-sm">
                    <img
                      src={serviceImageThumb(s.serviceImages[0].image_url)}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={handleImageError}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">{s.service_name}</h3>
                  {s.serviceCategories?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.serviceCategories.map((cat: any, i: number) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                          <CategoryIcon icon={cat.icon} size={10} className="text-accent" /> {cat.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {s.description && <p className="mt-1 line-clamp-2 text-xs text-foreground/70">{s.description}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {s.price && <span className="inline-flex items-center gap-0.5 font-medium text-foreground"><DollarSign className="h-3 w-3 text-accent" /> {s.price}</span>}
                    {s.service_area && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3 text-accent" /> {formatLocationString(s.service_area)}</span>}
                    {(s.instagram_url || s.facebook_url || s.youtube_url) && (
                      <span className="flex items-center gap-1">
                        {s.instagram_url && <Instagram className="h-3 w-3 text-accent" />}
                        {s.facebook_url && <Facebook className="h-3 w-3 text-accent" />}
                        {s.youtube_url && <Youtube className="h-3 w-3 text-accent" />}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center shrink-0" />
              </div>
              {s.serviceImages?.length > 1 && (
                <div className="mt-2 flex gap-1.5 overflow-hidden pl-[calc(5rem+0.75rem)]">
                  {s.serviceImages.slice(1, 4).map((img: any) => (
                    <div key={img.id} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border">
                      <img src={serviceImageThumb(img.image_url)} alt="" className="h-full w-full object-cover" loading="lazy" onError={handleImageError} />
                    </div>
                  ))}
                  {s.serviceImages.length > 4 && (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-medium text-muted-foreground">+{s.serviceImages.length - 4}</span>
                  )}
                </div>
              )}
            </motion.button>
          ))}
          {services.length === 0 && (
            <div className="text-center py-6 space-y-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado.</p>
            </div>
          )}
        </div>
      </motion.div>
      {selected && (
        <ServiceDetailDialog service={selected} open={!!selected} onClose={() => setSelected(null)} whatsapp={whatsapp} ctaWhatsappText={ctaWhatsappText} accentBg={accentBg} onImageClick={onImageClick} providerId={providerId} />
      )}
    </>
  );
};

const ProviderProfileWithGuard = () => (
  <ErrorGuard componentName="ProviderProfile" fallbackRoute="/ajuda">
    <ProviderProfile />
  </ErrorGuard>
);

export default ProviderProfileWithGuard;

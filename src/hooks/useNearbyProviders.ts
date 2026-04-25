import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DbProvider } from '@/hooks/useProviders';
import { logCoverageSearch } from '@/lib/coverageLog';
import { useOnlineUsersMap } from '@/hooks/useOnlinePresence';
import { useMemo } from 'react';

interface NearbyParams {
  lat: number | null | undefined;
  lng: number | null | undefined;
  radiusM?: number;
  categorySlug?: string;
  limit?: number;
}

export function useNearbyProviders({ lat, lng, radiusM = 50000, categorySlug, limit = 50 }: NearbyParams) {
  // Captura quem está online AGORA (Presence em memória).
  // Passamos o array para o RPC para que o boost de visibilidade seja aplicado server-side.
  const onlineMap = useOnlineUsersMap();
  const onlineIds = useMemo(() => Array.from(onlineMap.keys()), [onlineMap]);

  return useQuery({
    // Re-busca quando o conjunto de online users muda significativamente (size).
    // Mudanças finas (entrada/saída individual) usam staleTime para não floodar.
    queryKey: ['nearby-providers', lat, lng, radiusM, categorySlug, limit, onlineIds.length],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('nearby_providers', {
        _lat: lat ?? null,
        _lng: lng ?? null,
        _radius_m: radiusM,
        _category_slug: categorySlug || null,
        _limit: limit,
        _online_user_ids: onlineIds.length > 0 ? onlineIds : null,
      });

      if (error) throw error;

      // Fire-and-forget coverage search log
      if (lat != null && lng != null) {
        logCoverageSearch({
          lat,
          lng,
          radius_m: radiusM,
          category_slug: categorySlug || null,
          result_count: (data || []).length,
        });
      }

      return (data || []).map((p: any): DbProvider & { distanceKm: number; isOnline: boolean; visibilityScore: number } => ({
        id: p.id,
        userId: p.user_id,
        name: p.business_name || 'Profissional',
        businessName: p.business_name || undefined,
        category: p.category_name || '',
        categorySlug: p.category_slug || '',
        categoryIcon: p.category_icon || '🔧',
        city: p.city || '',
        state: p.state || '',
        neighborhood: p.neighborhood || '',
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        rating: Number(p.rating_avg) || 0,
        reviewCount: p.review_count || 0,
        photo: p.photo_url || '',
        description: p.description || '',
        phone: p.phone || '',
        whatsapp: p.whatsapp || p.phone || '',
        yearsExperience: p.years_experience || 0,
        plan: p.plan || 'free',
        slug: p.slug || p.id,
        featured: p.featured || false,
        servicesCount: p.services_count || 0,
        portfolioAlbumCount: p.portfolio_album_count || 0,
        portfolioPhotoCount: p.portfolio_photo_count || 0,
        distanceKm: p.distance_m != null ? Math.round((p.distance_m / 1000) * 10) / 10 : 0,
        isOnline: !!p.is_online,
        visibilityScore: Number(p.visibility_score) || 0,
      }));
    },
    // Permite chamar sem GPS — quando lat/lng são null, o RPC retorna ranking
    // dominado por status Online + engagement.
    enabled: true,
    staleTime: 1000 * 60 * 2,
  });
}

export function useNeighborhoodByPoint(lat: number | null | undefined, lng: number | null | undefined) {
  return useQuery({
    queryKey: ['neighborhood-by-point', lat, lng],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_neighborhood_by_point', {
        _lat: lat!,
        _lng: lng!,
      });
      if (error) throw error;
      return data as string | null;
    },
    enabled: lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng),
    staleTime: 1000 * 60 * 30,
  });
}

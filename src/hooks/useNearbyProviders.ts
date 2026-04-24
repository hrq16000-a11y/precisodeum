import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DbProvider } from '@/hooks/useProviders';
import { logCoverageSearch } from '@/lib/coverageLog';

interface NearbyParams {
  lat: number | null | undefined;
  lng: number | null | undefined;
  radiusM?: number;
  categorySlug?: string;
  limit?: number;
}

export function useNearbyProviders({ lat, lng, radiusM = 50000, categorySlug, limit = 50 }: NearbyParams) {
  return useQuery({
    queryKey: ['nearby-providers', lat, lng, radiusM, categorySlug, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('nearby_providers', {
        _lat: lat!,
        _lng: lng!,
        _radius_m: radiusM,
        _category_slug: categorySlug || null,
        _limit: limit,
      });

      if (error) throw error;

      // Fire-and-forget coverage search log (does not block result rendering).
      logCoverageSearch({
        lat: lat!,
        lng: lng!,
        radius_m: radiusM,
        category_slug: categorySlug || null,
        result_count: (data || []).length,
      });

      return (data || []).map((p: any): DbProvider & { distanceKm: number } => ({
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
        distanceKm: Math.round((p.distance_m / 1000) * 10) / 10,
      }));
    },
    enabled: lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng),
    staleTime: 1000 * 60 * 5,
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

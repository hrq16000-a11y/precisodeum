import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DbProvider } from '@/hooks/useProviders';
import type { Database } from '@/integrations/supabase/types';
import { logCoverageSearch } from '@/lib/coverageLog';
import { useOnlineUsersMap } from '@/hooks/useOnlinePresence';

type ProviderRow = Database['public']['Tables']['providers']['Row'];
// Shape devolvido por nearby_providers RPC: ProviderRow + colunas derivadas
// (distance_m, rating_avg, review_count, category_name/slug/icon, is_online,
// visibility_score, activity_signal, services_count, portfolio_*_count).
// Tipado como Partial para tolerar diferença entre RPC e Row puro.
type NearbyProviderRow = Partial<ProviderRow> & {
  id: string;
  user_id: string | null;
  distance_m?: number | null;
  rating_avg?: number | null;
  review_count?: number | null;
  category_name?: string | null;
  category_slug?: string | null;
  category_icon?: string | null;
  is_online?: boolean | null;
  visibility_score?: number | null;
  activity_signal?: string | null;
  services_count?: number | null;
  portfolio_album_count?: number | null;
  portfolio_photo_count?: number | null;
};
type PublicProfileRow = { id: string; full_name: string | null; avatar_url: string | null };

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
        _lat: lat ?? undefined,
        _lng: lng ?? undefined,
        _radius_m: radiusM,
        _category_slug: categorySlug || undefined,
        _limit: limit,
        _online_user_ids: onlineIds.length > 0 ? onlineIds : undefined,
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

      const rows = (data || []) as NearbyProviderRow[];

      // Enriquecimento: nome real + avatar real do profile (a RPC não retorna).
      const userIds = [...new Set(rows.map((r) => r.user_id).filter((id): id is string => !!id))];
      const profileMap: Record<string, { name: string | null; avatar: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('public_profiles' as any)
          .select('id, full_name, avatar_url')
          .in('id', userIds);
        (profs as unknown as PublicProfileRow[] | null)?.forEach((p) => {
          profileMap[p.id] = { name: p.full_name || null, avatar: p.avatar_url || null };
        });
      }


      // Bloqueio de "nomes" genéricos vazados em business_name
      const _norm = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
      const GENERIC = new Set([
        'pedreiro','padeiro','padreiro','eletricista','encanador','pintor','autonomo','profissional',
        'empreiteiro','marceneiro','jardineiro','tecnico','mecanico','servicosgerais','diarista',
        'cozinheiro','motorista','soldador','vidraceiro','gesseiro','azulejista','prestador',
        'profissionalautonomo','servico','servicos','autonoma','prestadora','tecnica',
      ]);
      const isGeneric = (s?: string | null) => {
        if (!s) return true;
        const n = _norm(s);
        return !n || GENERIC.has(n);
      };

      return rows.map((p: NearbyProviderRow): DbProvider & { distanceKm: number; isOnline: boolean; visibilityScore: number; activitySignal: 'em_alta' | 'responde_rapido' | 'ativo_recente' | null } => {
        const profile = profileMap[p.user_id];
        const fullName = profile?.name?.trim() || '';
        const businessName = (p.business_name || '').trim();
        const isCompany = (p.account_type || 'autonomous') === 'company';
        // PJ: business_name é o nome oficial (não filtra como genérico).
        const safeBusinessName = isCompany ? businessName : (isGeneric(businessName) ? '' : businessName);
        const resolvedName = isCompany
          ? (safeBusinessName || fullName || (p.city ? `Empresa em ${p.city}` : 'Empresa'))
          : (fullName || safeBusinessName || (p.city ? `Profissional em ${p.city}` : 'Profissional'));
        const resolvedPhoto = (p.photo_url || profile?.avatar || '').trim();

        return {
          id: p.id,
          userId: p.user_id,
          name: resolvedName,
          businessName: safeBusinessName || undefined,
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
          photo: resolvedPhoto,
          description: p.description || '',
          phone: p.phone || '',
          whatsapp: p.whatsapp || p.phone || '',
          yearsExperience: p.years_experience || 0,
          slug: p.slug || p.id,
          featured: p.featured || false,
          servicesCount: p.services_count || 0,
          portfolioAlbumCount: p.portfolio_album_count || 0,
          portfolioPhotoCount: p.portfolio_photo_count || 0,
          distanceKm: p.distance_m != null ? Math.round((p.distance_m / 1000) * 10) / 10 : 0,
          isOnline: !!p.is_online,
          visibilityScore: Number(p.visibility_score) || 0,
          activitySignal: (p.activity_signal as any) || null,
          accountType: (p.account_type as any) || 'autonomous',
          businessSegment: p.business_segment ?? null,
          street: p.street ?? null,
          streetNumber: p.street_number ?? null,
          complement: p.complement ?? null,
          postalCode: p.postal_code ?? null,
          socialLinks: (p.social_links as any) ?? null,
          showFullAddress: p.show_full_address === true,
        };
      });
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

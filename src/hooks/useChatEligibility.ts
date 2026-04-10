import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ChatSettings {
  id: string;
  enabled: boolean;
  allowed_profile_types: string[];
  min_services: number;
  min_portfolio_albums: number;
  blocked_message: string;
  welcome_message: string;
  max_message_length: number;
  allow_images: boolean;
}

export function useChatEligibility() {
  const { user } = useAuth();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['chat-settings'],
    queryFn: async () => {
      const { data } = await (supabase.from('chat_settings' as any).select('*').limit(1).single() as any);
      return data as ChatSettings | null;
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: eligibility, isLoading: eligibilityLoading } = useQuery({
    queryKey: ['chat-eligibility', user?.id],
    enabled: !!user?.id && !!settings?.enabled,
    queryFn: async () => {
      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('profile_type')
        .eq('id', user!.id)
        .single();

      if (!profile) return { eligible: false, reason: 'Perfil não encontrado' };

      const allowedTypes: string[] = settings?.allowed_profile_types || ['provider', 'rh'];
      if (!allowedTypes.includes(profile.profile_type)) {
        return { eligible: false, reason: 'Seu tipo de perfil não tem acesso ao chat' };
      }

      // Get provider
      const { data: provider } = await supabase
        .from('providers')
        .select('id, services_count, portfolio_album_count')
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .single();

      if (!provider) {
        return { eligible: false, reason: 'Você precisa ter um perfil de prestador ativo' };
      }

      const minServices = settings?.min_services ?? 3;
      const minAlbums = settings?.min_portfolio_albums ?? 1;

      if (provider.services_count < minServices) {
        return {
          eligible: false,
          reason: `Você precisa ter pelo menos ${minServices} serviço(s) publicado(s). Atual: ${provider.services_count}`,
        };
      }

      if (provider.portfolio_album_count < minAlbums) {
        return {
          eligible: false,
          reason: `Você precisa ter pelo menos ${minAlbums} álbum(ns) de portfólio. Atual: ${provider.portfolio_album_count}`,
        };
      }

      return { eligible: true, reason: '' };
    },
    staleTime: 1000 * 60,
  });

  return {
    settings,
    isEnabled: settings?.enabled ?? false,
    eligible: eligibility?.eligible ?? false,
    reason: eligibility?.reason || settings?.blocked_message || '',
    isLoading: settingsLoading || eligibilityLoading,
  };
}

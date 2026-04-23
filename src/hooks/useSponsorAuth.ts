import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { hasSponsorFeatureAccess, isSponsorSubscriptionActive, type SponsorSubscription } from '@/lib/sponsorAccess';
import { toast } from 'sonner';

export type SponsorPermissionKey = 'banners' | 'campanhas' | 'metricas' | 'contratos' | 'notificacoes' | 'dados';

export interface SponsorPermissions {
  banners: boolean;
  campanhas: boolean;
  metricas: boolean;
  contratos: boolean;
  notificacoes: boolean;
  dados: boolean;
}

const ALL_PERMISSIONS: SponsorPermissions = {
  banners: true,
  campanhas: true,
  metricas: true,
  contratos: true,
  notificacoes: true,
  dados: true,
};

interface SponsorContact {
  id: string;
  user_id: string;
  sponsor_id: string;
  company_name: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  permissions: SponsorPermissions;
}

interface SponsorData {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
  position: string;
  tier: string;
  active: boolean;
  impressions: number;
  clicks: number;
  start_date: string | null;
  end_date: string | null;
  display_order: number;
}

export function useSponsorAuth(redirectIfNot = true) {
  const { user, loading: authLoading } = useAuth();
  const [sponsorContact, setSponsorContact] = useState<SponsorContact | null>(null);
  const [sponsor, setSponsor] = useState<SponsorData | null>(null);
  const [subscription, setSubscription] = useState<SponsorSubscription | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refetch = useCallback(async () => {
    if (!user) return;
    const { data: contact } = await supabase
      .from('sponsor_contacts' as any)
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (contact) {
      setSponsorContact(contact as any);
      const { data: sp } = await supabase
        .from('sponsors')
        .select('*')
        .eq('id', (contact as any).sponsor_id)
        .single();
      setSponsor(sp as any);

      const { data: sub } = await supabase
        .from('sponsor_subscriptions')
        .select('*, sponsor_plans(id, name, slug, features)')
        .eq('sponsor_id', (contact as any).sponsor_id)
        .in('status', ['active', 'trialing'])
        .order('current_period_end', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      setSubscription(sub as SponsorSubscription | null);
    } else {
      setSponsorContact(null);
      setSponsor(null);
      setSubscription(null);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      if (redirectIfNot) navigate('/login', { replace: true });
      setLoading(false);
      return;
    }

    // Check admin status in parallel with sponsor contact
    Promise.all([
      refetch(),
      supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }).then(({ data }) => {
        setIsAdmin(!!data);
      }),
    ]).finally(() => setLoading(false));
  }, [user, authLoading, navigate, redirectIfNot, refetch]);

  useEffect(() => {
    // Only redirect non-admins who aren't sponsor contacts
    if (!loading && !authLoading && !sponsorContact && !isAdmin && user && redirectIfNot) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, authLoading, sponsorContact, isAdmin, user, redirectIfNot, navigate]);

  useEffect(() => {
    if (!sponsorContact?.sponsor_id) return;

    const channel = supabase
      .channel(`sponsor-subscription-${sponsorContact.sponsor_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sponsor_subscriptions',
          filter: `sponsor_id=eq.${sponsorContact.sponsor_id}`,
        },
        () => {
          void refetch();
          toast.info('Status da assinatura atualizado');
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sponsorContact?.sponsor_id, refetch]);

  const permissions: SponsorPermissions = isAdmin
    ? ALL_PERMISSIONS
    : (sponsorContact?.permissions ?? ALL_PERMISSIONS);

  const hasActivePlan = isAdmin || isSponsorSubscriptionActive(subscription);
  const hasSponsorPermission = (key: SponsorPermissionKey) => hasSponsorFeatureAccess({ isAdmin, hasActivePlan, permissions, key });

  return { sponsorContact, sponsor, subscription, hasActivePlan, loading: loading || authLoading, user, isAdmin, refetch, permissions, hasSponsorPermission };
}

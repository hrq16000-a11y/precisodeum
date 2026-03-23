import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface SponsorContact {
  id: string;
  user_id: string;
  sponsor_id: string;
  company_name: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  role: string;
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
    } else {
      setSponsorContact(null);
      setSponsor(null);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      if (redirectIfNot) navigate('/login', { replace: true });
      setLoading(false);
      return;
    }

    refetch().finally(() => setLoading(false));
  }, [user, authLoading, navigate, redirectIfNot, refetch]);

  useEffect(() => {
    if (!loading && !authLoading && !sponsorContact && user && redirectIfNot) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, authLoading, sponsorContact, user, redirectIfNot, navigate]);

  return { sponsorContact, sponsor, loading: loading || authLoading, user, refetch };
}

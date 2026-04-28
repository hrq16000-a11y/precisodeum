import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface VerifiedCriteria {
  profile_min_complete?: { photo?: boolean; description?: boolean; service?: boolean };
  contact_geo_complete?: { whatsapp?: boolean; city?: boolean; gps?: boolean };
}

export interface ProviderVerifiedDetails {
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedReason: string | null;
  verifiedManual: boolean;
  verifiedBy: string | null;
  criteria: VerifiedCriteria;
}

/**
 * Lê os campos de verificação de um provider (selo "Profissional Top")
 * para exibir na seção "Por que é Top" no perfil público.
 */
export function useProviderVerifiedDetails(providerId?: string | null) {
  const [data, setData] = useState<ProviderVerifiedDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!providerId) {
      setData(null);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const { data: row, error } = await supabase
        .from('providers')
        .select('is_verified, verified_at, verified_reason, verified_manual, verified_by, verified_criteria')
        .eq('id', providerId)
        .maybeSingle();
      if (!active) return;
      if (error || !row) {
        setData(null);
      } else {
        setData({
          isVerified: !!(row as any).is_verified,
          verifiedAt: (row as any).verified_at,
          verifiedReason: (row as any).verified_reason,
          verifiedManual: !!(row as any).verified_manual,
          verifiedBy: (row as any).verified_by,
          criteria: ((row as any).verified_criteria as VerifiedCriteria) || {},
        });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [providerId]);

  return { data, loading };
}

/** Lista plana de critérios para renderização. */
export const CRITERIA_LABELS: Array<{ key: string; group: 'profile' | 'contact'; label: string; }> = [
  { key: 'photo',       group: 'profile', label: 'Foto de perfil enviada' },
  { key: 'description', group: 'profile', label: 'Descrição com pelo menos 30 caracteres' },
  { key: 'service',     group: 'profile', label: 'Pelo menos 1 serviço cadastrado' },
  { key: 'whatsapp',    group: 'contact', label: 'WhatsApp válido' },
  { key: 'city',        group: 'contact', label: 'Cidade preenchida' },
  { key: 'gps',         group: 'contact', label: 'Localização GPS (lat/lng)' },
];

export function flattenCriteria(c: VerifiedCriteria): Record<string, boolean> {
  return {
    photo:       !!c?.profile_min_complete?.photo,
    description: !!c?.profile_min_complete?.description,
    service:     !!c?.profile_min_complete?.service,
    whatsapp:    !!c?.contact_geo_complete?.whatsapp,
    city:        !!c?.contact_geo_complete?.city,
    gps:         !!c?.contact_geo_complete?.gps,
  };
}

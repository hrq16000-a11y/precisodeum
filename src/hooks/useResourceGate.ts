/**
 * useResourceGate — consulta a matriz efetiva de permissões (perfil base + bônus do nível).
 * Mantém compatibilidade com chamadas existentes: { check(resource), allowed, reason }.
 */
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export type ResourceKey =
  | 'can_create_services'
  | 'can_receive_leads'
  | 'can_access_crm'
  | 'can_access_reports'
  | 'can_access_featured'
  | 'can_view_client_phone'
  | 'can_use_advanced_dashboard'
  | 'top_search_placement'
  | 'verified_badge'
  | 'max_services'
  | 'max_leads'
  | 'max_ads'
  | 'max_slots'
  | 'radius_km';

export interface EffectivePermissions {
  tier_key: string;
  tier_label: string;
  max_services: number;
  max_leads: number;
  max_ads: number;
  max_slots: number;
  radius_km: number;
  ranking_priority: number;
  search_boost: number;
  can_create_services: boolean;
  can_receive_leads: boolean;
  can_access_crm: boolean;
  can_access_reports: boolean;
  can_access_featured: boolean;
  can_view_client_phone: boolean;
  can_use_advanced_dashboard: boolean;
  top_search_placement: boolean;
  verified_badge: boolean;
}

interface GateResult {
  allowed: boolean;
  reason?: string;
  value?: number;
}

const cache = new Map<string, { data: EffectivePermissions; ts: number }>();
const TTL_MS = 60_000;

export const useResourceGate = () => {
  const { user } = useAuth();
  const [perms, setPerms] = useState<EffectivePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setPerms(null);
      setLoading(false);
      return;
    }

    const cached = cache.get(user.id);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      setPerms(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .rpc('effective_user_permissions', { _user_id: user.id })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data && typeof data === 'object') {
          const p = data as unknown as EffectivePermissions;
          cache.set(user.id, { data: p, ts: Date.now() });
          setPerms(p);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user?.id]);

  const check = useCallback((resource: ResourceKey): GateResult => {
    // Sem perfil carregado, libera (não bloqueia UI durante load).
    if (!perms) return { allowed: true };

    // Numéricos: -1 = ilimitado, 0 = bloqueado, >0 = permitido
    if (resource.startsWith('max_') || resource === 'radius_km') {
      const v = (perms as any)[resource] as number;
      if (v === -1) return { allowed: true, value: -1 };
      if (v === 0) return { allowed: false, reason: 'Recurso indisponível no seu perfil atual.', value: 0 };
      return { allowed: true, value: v };
    }

    // Booleanos
    const v = (perms as any)[resource] as boolean | undefined;
    if (v === true) return { allowed: true };
    return { allowed: false, reason: 'Suba de nível para desbloquear esse recurso.' };
  }, [perms]);

  return { check, loading, permissions: perms, limits: perms };
};

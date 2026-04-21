import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const LS_KEY = 'pdu_favorites_v1';

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ids));
  } catch {
    // ignore quota
  }
}

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load favorites: from DB if logged, else localStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (user?.id) {
        // Migrate any existing localStorage favorites into DB on first login
        const local = readLocal();
        if (local.length > 0) {
          await supabase
            .from('user_favorites')
            .upsert(local.map((pid) => ({ user_id: user.id, provider_id: pid })), { onConflict: 'user_id,provider_id' });
          writeLocal([]);
        }
        const { data } = await supabase
          .from('user_favorites')
          .select('provider_id')
          .eq('user_id', user.id);
        if (!cancelled) {
          setFavorites(new Set((data || []).map((r: any) => r.provider_id)));
        }
      } else {
        if (!cancelled) setFavorites(new Set(readLocal()));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const toggle = useCallback(
    async (providerId: string) => {
      const isFav = favorites.has(providerId);
      const next = new Set(favorites);
      if (isFav) next.delete(providerId);
      else next.add(providerId);
      setFavorites(next);

      if (user?.id) {
        if (isFav) {
          await supabase
            .from('user_favorites')
            .delete()
            .eq('user_id', user.id)
            .eq('provider_id', providerId);
        } else {
          await supabase
            .from('user_favorites')
            .insert({ user_id: user.id, provider_id: providerId });
        }
      } else {
        writeLocal(Array.from(next));
      }
      return !isFav;
    },
    [favorites, user?.id]
  );

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  return { favorites, isFavorite, toggle, loading };
}

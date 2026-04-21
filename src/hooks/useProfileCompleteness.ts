import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CompletenessResult {
  percentage: number;
  breakdown: { photo: number; services: number; portfolio: number; data: number };
  counts: { services: number; albums: number; photos: number };
}

const STORAGE_KEY_PREFIX = 'completeness_celebrated_v1:';

/**
 * Centralized profile completeness using the SQL RPC `get_profile_completeness`.
 * Triggers a one-time confetti + sound celebration when the user crosses 90% for the first time.
 */
export function useProfileCompleteness() {
  const { user, provider } = useAuth();
  const [data, setData] = useState<CompletenessResult | null>(null);
  const [loading, setLoading] = useState(false);
  const celebratedRef = useRef(false);

  const fetch = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: rpc, error } = await supabase.rpc('get_profile_completeness', { _user_id: user.id });
      if (!error && rpc) setData(rpc as unknown as CompletenessResult);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, provider?.id]);

  // First-time 90% celebration
  useEffect(() => {
    if (!user?.id || !data) return;
    const key = STORAGE_KEY_PREFIX + user.id;
    const already = localStorage.getItem(key);
    if (already || celebratedRef.current) return;
    if (data.percentage >= 90) {
      celebratedRef.current = true;
      localStorage.setItem(key, String(Date.now()));
      void celebrateMilestone();
    }
  }, [data, user?.id]);

  return { data, loading, refetch: fetch };
}

async function celebrateMilestone() {
  try {
    const confetti = (await import('canvas-confetti')).default;
    const fire = (particleRatio: number, opts: any) => {
      confetti({ origin: { y: 0.7 }, ...opts, particleCount: Math.floor(220 * particleRatio) });
    };
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  } catch {
    // confetti not available — silent fallback
  }
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'triangle';
    o.frequency.setValueAtTime(523.25, ctx.currentTime);          // C5
    o.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);   // E5
    o.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24);   // G5
    o.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.36);   // C6
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
    o.start(); o.stop(ctx.currentTime + 0.7);
  } catch {
    // audio blocked — silent
  }
}

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Activity, Sparkles, ChevronRight, Camera, FileText, Briefcase, Image, Phone, Star, Zap, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const ICONS: Record<string, any> = {
  Camera, FileText, Briefcase, Image, Phone, Star, Zap, TrendingUp,
};

interface Suggestion {
  priority: number;
  icon: string;
  text: string;
  action: string;
}

interface HealthData {
  score: number;
  suggestions: Suggestion[];
  breakdown: { reviews: number; leads: number; avg_response_min: number };
}

const ProfileHealthScore = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['profile-health', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: result, error } = await supabase.rpc('get_profile_health_score' as any, { _user_id: user.id });
      if (error) throw error;
      return result as unknown as HealthData;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  if (isLoading || !data) return null;

  const score = data.score ?? 0;
  const suggestions = data.suggestions ?? [];

  // Status badge based on score
  const status = score >= 85
    ? { label: 'Excelente', color: 'hsl(142 71% 45%)', emoji: 'Saúde ótima' }
    : score >= 60
      ? { label: 'Bom', color: 'hsl(217 91% 60%)', emoji: 'Boa saúde' }
      : score >= 40
        ? { label: 'Regular', color: 'hsl(38 92% 50%)', emoji: 'Pode melhorar' }
        : { label: 'Baixo', color: 'hsl(0 84% 60%)', emoji: 'Atenção necessária' };

  // SVG circle math
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/10">
          <Activity className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base font-bold text-foreground flex items-center gap-1.5">
            Saúde do Perfil
            <Sparkles className="h-3.5 w-3.5 text-accent" />
          </h3>
          <p className="text-[11px] text-muted-foreground">Análise inteligente baseada nos seus dados</p>
        </div>
      </div>

      {/* Score circle + breakdown */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <svg width="100" height="100" className="-rotate-90">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
            <motion.circle
              cx="50" cy="50" r={radius} fill="none"
              stroke={status.color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-2xl font-bold text-foreground tabular-nums">{score}</span>
            <span className="text-[9px] text-muted-foreground -mt-0.5">de 100</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ backgroundColor: `${status.color}20`, color: status.color }}
          >
            {status.label}
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="rounded-lg bg-muted/50 p-1.5 text-center">
              <p className="font-bold text-foreground tabular-nums">{data.breakdown?.reviews ?? 0}</p>
              <p className="text-muted-foreground">Reviews</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-1.5 text-center">
              <p className="font-bold text-foreground tabular-nums">{data.breakdown?.leads ?? 0}</p>
              <p className="text-muted-foreground">Leads</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-1.5 text-center">
              <p className="font-bold text-foreground tabular-nums">
                {data.breakdown?.avg_response_min > 0 ? `${Math.round(data.breakdown.avg_response_min)}m` : '—'}
              </p>
              <p className="text-muted-foreground">Resposta</p>
            </div>
          </div>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Sugestões para você</p>
          {suggestions.map((s, i) => {
            const Icon = ICONS[s.icon] || Sparkles;
            return (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                onClick={() => navigate(s.action)}
                className="w-full flex items-start gap-2.5 rounded-xl border border-border bg-background p-2.5 text-left transition-all hover:border-accent/40 hover:bg-accent/5"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <p className="flex-1 text-[11px] text-foreground leading-snug">{s.text}</p>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              </motion.button>
            );
          })}
        </div>
      )}

      {suggestions.length === 0 && score >= 85 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-primary/10 p-3 text-center"
        >
          <p className="text-xs font-bold text-foreground">Perfil otimizado! Continue assim para manter o destaque.</p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ProfileHealthScore;

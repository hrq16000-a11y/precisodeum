import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Sparkles, Clock3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DailyPost {
  id: string;
  image_url: string | null;
  caption: string;
  created_at: string;
  expires_at: string;
  hours_remaining: number;
}

interface Props {
  providerId: string;
}

/**
 * Bloco "Obra do Dia" exibido no perfil público.
 * Aparece apenas se houver postagem ativa (não expirada).
 */
export default function DailyPostHighlight({ providerId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['daily-post-public', providerId],
    enabled: !!providerId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_provider_daily_post' as any, {
        _provider_id: providerId,
      });
      if (error) throw error;
      const arr = (data || []) as DailyPost[];
      return arr.length > 0 ? arr[0] : null;
    },
  });

  if (isLoading || !data) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/10 via-pink-500/5 to-transparent p-4 shadow-sm"
      aria-label="Obra do Dia"
    >
      <header className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-600">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-sm font-bold uppercase tracking-wide text-fuchsia-700 dark:text-fuchsia-400">
          Obra do Dia
        </h2>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock3 className="h-3 w-3" />
          {Math.max(0, Math.round(data.hours_remaining))}h restantes
        </span>
      </header>

      {data.image_url ? (
        <img
          src={data.image_url}
          alt={data.caption.slice(0, 80)}
          loading="lazy"
          className="mb-3 max-h-72 w-full rounded-xl object-cover"
        />
      ) : null}

      <p className="text-sm leading-relaxed text-foreground">{data.caption}</p>
    </motion.section>
  );
}

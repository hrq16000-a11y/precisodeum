import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthIdentity } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';

/**
 * Widget "Saúde do Perfil — Benchmark da Categoria"
 *
 * Compara os engagement_points do usuário logado com a média da sua categoria
 * principal e mostra a diferença em percentual com um medidor estilo
 * "smartphone settings" (vermelho/amarelo/verde).
 *
 * - Não cria nova tabela: usa profiles.engagement_points + providers.category_id
 *   (ambos já existentes; query agregada no client).
 * - Falha silenciosa: se o usuário não for prestador / sem categoria, o widget
 *   não renderiza, evitando ruído visual no dashboard de clientes.
 */
const CategoryBenchmarkWidget = () => {
  const { user } = useAuthIdentity();

  const { data } = useQuery({
    queryKey: ['category-benchmark', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // 1) provider do usuário (precisamos do category_id)
      const { data: me, error: meErr } = await supabase
        .from('providers')
        .select('id, category_id, business_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (meErr || !me?.category_id) return null;

      // 2) engagement_points do usuário (vem de profiles)
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('engagement_points')
        .eq('id', user.id)
        .maybeSingle();
      const myPoints = Number(myProfile?.engagement_points ?? 0);

      // 3) demais prestadores da mesma categoria (limit 1000 — suficiente para média estável)
      const { data: peers } = await supabase
        .from('providers')
        .select('user_id')
        .eq('category_id', me.category_id)
        .neq('user_id', user.id)
        .limit(1000);

      const peerIds = (peers ?? []).map((p) => p.user_id).filter(Boolean) as string[];
      if (peerIds.length === 0) {
        return { myPoints, avg: 0, sampleSize: 0, categoryName: null as string | null };
      }

      const { data: peerProfiles } = await supabase
        .from('profiles')
        .select('engagement_points')
        .in('id', peerIds);

      const points = (peerProfiles ?? []).map((p) => Number(p.engagement_points ?? 0));
      const avg = points.length > 0 ? points.reduce((s, n) => s + n, 0) / points.length : 0;

      // 4) nome da categoria (cosmético)
      const { data: cat } = await supabase
        .from('categories')
        .select('name')
        .eq('id', me.category_id)
        .maybeSingle();

      return {
        myPoints,
        avg,
        sampleSize: points.length,
        categoryName: cat?.name ?? null,
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  if (!data) return null;
  if (data.sampleSize < 3) return null; // amostra muito pequena — evitar comparação enviesada

  const { myPoints, avg, categoryName } = data;
  const diffPct = avg > 0 ? Math.round(((myPoints - avg) / avg) * 100) : 0;
  const above = diffPct >= 0;

  // medidor 0..100% relativo ao dobro da média (cap)
  const max = Math.max(avg * 2, myPoints, 50);
  const fill = Math.max(4, Math.min(100, Math.round((myPoints / max) * 100)));

  // cor por faixa
  const color =
    diffPct >= 15
      ? 'hsl(142 71% 45%)' // verde
      : diffPct >= -10
        ? 'hsl(45 93% 47%)' // amarelo
        : 'hsl(0 84% 60%)'; // vermelho

  const Icon = diffPct >= 15 ? TrendingUp : diffPct <= -10 ? TrendingDown : Minus;
  const label = above
    ? `Seu perfil é ${Math.abs(diffPct)}% mais completo que a média${categoryName ? ` em ${categoryName}` : ''}`
    : `Seu perfil está ${Math.abs(diffPct)}% abaixo da média${categoryName ? ` em ${categoryName}` : ''}`;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: `${color}20`, color }}
          aria-hidden
        >
          <Activity className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-semibold text-foreground">
              Saúde do Perfil
            </h3>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ background: `${color}20`, color }}
            >
              <Icon className="h-3 w-3" aria-hidden />
              {above ? '+' : ''}
              {diffPct}%
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>

          <div className="mt-3" aria-label="Comparativo com a média da categoria">
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
              {/* marca da média */}
              <div
                className="absolute inset-y-0 z-10 w-px bg-foreground/40"
                style={{ left: `${Math.min(100, Math.round((avg / max) * 100))}%` }}
                aria-hidden
              />
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${fill}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
              <span>Você: {myPoints} pts</span>
              <span>Média: {Math.round(avg)} pts</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default CategoryBenchmarkWidget;

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Briefcase, Image as ImageIcon, Star, MapPin, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PublicAchievementsStripProps {
  userId: string;
  servicesCount?: number;
  portfolioPhotoCount?: number;
  ratingAvg?: number;
  reviewCount?: number;
  city?: string | null;
  state?: string | null;
  levelName?: string | null;
}

interface Item {
  key: string;
  label: string;
  icon: LucideIcon;
  cls: string;
}

/**
 * PublicAchievementsStrip — "Mural de Vitrines" exibido no perfil público.
 * Mostra um resumo das conquistas reais do profissional para gerar prova
 * social imediata em quem quer contratar.
 *
 * Combina dados estáticos do provider (serviços ativos, fotos, rating) com
 * uma checagem leve no audit_log para detectar marcos recentes (ex.: nível
 * Diamante alcançado nos últimos 60 dias).
 */
const PublicAchievementsStrip = ({
  userId,
  servicesCount = 0,
  portfolioPhotoCount = 0,
  ratingAvg = 0,
  reviewCount = 0,
  city,
  state,
  levelName,
}: PublicAchievementsStripProps) => {
  const [recentLevelUp, setRecentLevelUp] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      // Last level_up event in the last 60 days, if any
      const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('audit_log')
        .select('details, created_at')
        .eq('user_id', userId)
        .eq('action', 'level_up')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      const lvl = (data?.details as any)?.level_name || null;
      if (lvl) setRecentLevelUp(lvl);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const items: Item[] = [];

  if (levelName) {
    const lower = levelName.toLowerCase();
    if (lower.includes('diamante') || lower.includes('mestre') || lower.includes('ouro')) {
      items.push({
        key: 'level',
        label: `Profissional Nível ${levelName}`,
        icon: Trophy,
        cls: 'from-amber-500/15 to-amber-600/5 text-amber-700 border-amber-500/30',
      });
    }
  }

  if (servicesCount >= 5) {
    items.push({
      key: 'services',
      label: 'Vitrine completa: 5 serviços ativos',
      icon: Briefcase,
      cls: 'from-blue-500/15 to-blue-600/5 text-blue-700 border-blue-500/30',
    });
  } else if (servicesCount >= 3) {
    items.push({
      key: 'services',
      label: `${servicesCount} serviços ativos`,
      icon: Briefcase,
      cls: 'from-blue-500/15 to-blue-600/5 text-blue-700 border-blue-500/30',
    });
  }

  if (portfolioPhotoCount >= 10) {
    items.push({
      key: 'portfolio',
      label: `Portfólio com ${portfolioPhotoCount}+ fotos`,
      icon: ImageIcon,
      cls: 'from-pink-500/15 to-pink-600/5 text-pink-700 border-pink-500/30',
    });
  }

  if (ratingAvg >= 4.5 && reviewCount >= 3) {
    items.push({
      key: 'rating',
      label: `Avaliação ${ratingAvg.toFixed(1)} ★ (${reviewCount})`,
      icon: Star,
      cls: 'from-yellow-500/15 to-yellow-600/5 text-yellow-700 border-yellow-500/30',
    });
  }

  if (city && state) {
    items.push({
      key: 'region',
      label: `Mestre da Região: ${city} - ${state}`,
      icon: MapPin,
      cls: 'from-emerald-500/15 to-emerald-600/5 text-emerald-700 border-emerald-500/30',
    });
  }

  if (recentLevelUp) {
    items.push({
      key: 'levelup',
      label: `Conquistou ${recentLevelUp} recentemente`,
      icon: ShieldCheck,
      cls: 'from-purple-500/15 to-purple-600/5 text-purple-700 border-purple-500/30',
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Últimas conquistas
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.span
              key={item.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className={`inline-flex items-center gap-1.5 rounded-full border bg-gradient-to-br px-2.5 py-1 text-[11px] font-medium ${item.cls}`}
            >
              <Icon className="h-3 w-3" strokeWidth={2} />
              {item.label}
            </motion.span>
          );
        })}
      </div>
    </div>
  );
};

export default PublicAchievementsStrip;

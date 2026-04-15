import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gift, Copy, Share2, Users, Lock, CheckCircle2, TrendingUp, ExternalLink } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import GlassCard from '@/components/ui/GlassCard';
import GamificationLevelBadge from '@/components/dashboard/GamificationLevelBadge';

const SITE_URL = window.location.origin;

const DashboardReferralsPage = () => {
  const { user, profile } = useAuth();
  const { levelName } = usePermissions();

  // Generate or fetch referral code
  const { data: referralCode, isLoading: codeLoading } = useQuery({
    queryKey: ['my-referral-code', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      // Check existing
      const { data: existing } = await supabase
        .from('referrals')
        .select('referral_code')
        .eq('referrer_id', user.id)
        .limit(1);
      if (existing && existing.length > 0) return existing[0].referral_code;

      // Create new code
      const code = user.id.slice(0, 8).toUpperCase();
      await supabase.from('referrals').insert({
        referrer_id: user.id,
        referral_code: code,
        status: 'pending',
      });
      return code;
    },
    enabled: !!user?.id,
  });

  // Stats
  const { data: referralStats } = useQuery({
    queryKey: ['referral-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return { total: 0, completed: 0, points: 0 };
      const { data, count } = await supabase
        .from('referrals')
        .select('*', { count: 'exact' })
        .eq('referrer_id', user.id);
      const completed = (data || []).filter(r => r.status === 'completed').length;
      const points = (data || []).reduce((sum, r) => sum + (r.points_awarded || 0), 0);
      return { total: count || 0, completed, points };
    },
    enabled: !!user?.id,
  });

  // Sponsor rewards locked by level
  const { data: sponsors = [] } = useQuery({
    queryKey: ['sponsor-rewards'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsors')
        .select('id, company_name, logo_url, cta_text, link_url')
        .eq('active', true)
        .limit(6);
      return data || [];
    },
  });

  const referralLink = referralCode ? `${SITE_URL}/cadastro?ref=${referralCode}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Link copiado!');
  };

  const shareWhatsApp = () => {
    const text = `Conheça a plataforma Preciso de Um! Cadastre-se com meu link e ganhe vantagens: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const levelPriority = getLevelPriority(levelName);

  // Rewards tiers
  const rewards = [
    { minLevel: 0, label: 'Visibilidade no ranking local', icon: TrendingUp, unlocked: true },
    { minLevel: 2, label: 'Selo "Indicador" no perfil', icon: CheckCircle2, unlocked: levelPriority >= 2 },
    { minLevel: 3, label: 'Ofertas exclusivas de Patrocinadores', icon: Gift, unlocked: levelPriority >= 3 },
    { minLevel: 4, label: 'Destaque VIP nas buscas', icon: TrendingUp, unlocked: levelPriority >= 4 },
  ];

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent/20 to-accent/5">
          <Gift className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Indicações</h1>
          <p className="text-sm text-muted-foreground">Indique colegas e ganhe +50 pontos por indicação</p>
        </div>
      </motion.div>

      {/* Referral Link Card */}
      <GlassCard variant="gradient" className="mt-6">
        <h2 className="font-display text-base font-bold text-foreground mb-3">Seu link de indicação</h2>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={codeLoading ? 'Gerando...' : referralLink}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground truncate"
          />
          <Button size="sm" variant="outline" onClick={copyLink} disabled={!referralCode}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="accent" onClick={shareWhatsApp} disabled={!referralCode}>
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Compartilhe este link. Quando um colega se cadastrar, vocês dois ganham pontos de engajamento!
        </p>
      </GlassCard>

      {/* Stats */}
      <div className="mt-4 grid gap-3 grid-cols-3">
        {[
          { label: 'Indicações', value: referralStats?.total ?? 0 },
          { label: 'Concluídas', value: referralStats?.completed ?? 0 },
          { label: 'Pontos ganhos', value: referralStats?.points ?? 0 },
        ].map((s) => (
          <Card key={s.label} className="p-4 text-center border-border bg-card">
            <p className="text-2xl font-black text-foreground">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Rewards Section */}
      <div className="mt-6">
        <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
          <Gift className="h-5 w-5 text-accent" /> Rewards — Clube de Vantagens
        </h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {rewards.map((r, i) => (
            <motion.div
              key={r.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-xl border p-4 transition-all ${r.unlocked ? 'border-accent/30 bg-accent/5' : 'border-border bg-muted/30 opacity-60'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${r.unlocked ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'}`}>
                  {r.unlocked ? <r.icon className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${r.unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>{r.label}</p>
                  {!r.unlocked && <p className="text-[10px] text-muted-foreground">Nível {r.minLevel}+ necessário</p>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Sponsor Offers */}
      {sponsors.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display text-lg font-bold text-foreground mb-3">
            Ofertas de Patrocinadores
          </h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {sponsors.map((s: any) => {
              const locked = levelPriority < 3;
              return (
                <Card key={s.id} className={`p-4 border-border ${locked ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    {s.logo_url && <img src={s.logo_url} alt={s.company_name} className="h-10 w-10 rounded-lg object-contain bg-white border border-border" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{s.company_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.cta_text || 'Oferta exclusiva'}</p>
                    </div>
                    {locked ? (
                      <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <a href={s.link_url} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-accent hover:underline">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  {locked && <p className="mt-2 text-[10px] text-muted-foreground">🔒 Disponível a partir do Nível Prata</p>}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

function getLevelPriority(levelName: string): number {
  const map: Record<string, number> = {
    'Bronze': 1, 'Prata': 2, 'Ouro': 3, 'Diamante': 4, 'Mestre': 5,
  };
  return map[levelName] || 0;
}

export default DashboardReferralsPage;

import { motion } from 'framer-motion';
import { Gift, Copy, Share2, Users, Lock, CheckCircle2, TrendingUp, ExternalLink, Clock, Sparkles } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import GlassCard from '@/components/ui/GlassCard';

const SITE_URL = typeof window !== 'undefined' ? window.location.origin : '';

const DashboardReferralsPage = () => {
  const { user, profile } = useAuth();
  const { levelName } = usePermissions();

  // Referral code is generated automatically on profile creation (trigger)
  const referralCode = (profile as any)?.referral_code || null;

  // Stats from referrals table
  const { data: referralStats } = useQuery({
    queryKey: ['referral-stats-v2', user?.id],
    queryFn: async () => {
      if (!user?.id) return { total: 0, completed: 0, pending: 0, points: 0, recent: [] as any[] };
      const { data } = await (supabase as any)
        .from('referrals')
        .select('id, status, points_awarded, created_at, completed_at, referred_id, profiles!referrals_referred_id_fkey(full_name, avatar_url)')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });
      const list = data || [];
      const completed = list.filter((r: any) => r.status === 'completed').length;
      const pending = list.filter((r: any) => r.status === 'pending').length;
      const points = list.reduce((sum: number, r: any) => sum + (r.points_awarded || 0), 0);
      return { total: list.length, completed, pending, points, recent: list.slice(0, 5) };
    },
    enabled: !!user?.id,
  });

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
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    toast.success('Link copiado!');
  };

  const shareWhatsApp = () => {
    if (!referralLink) return;
    const text = `Conheça a Preciso de Um — a plataforma para profissionais valorizarem seu trabalho. Cadastre-se com meu link: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const levelPriority = getLevelPriority(levelName);

  const rewards = [
    { minLevel: 0, label: '+100 pontos por indicação concluída', icon: Sparkles, unlocked: true },
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
          <h1 className="font-display text-2xl font-bold text-foreground">Indicações P2P</h1>
          <p className="text-sm text-muted-foreground">Indique colegas — vocês dois ganham 100 pontos quando o cadastro for concluído</p>
        </div>
      </motion.div>

      {/* Referral Link Card */}
      <GlassCard variant="gradient" className="mt-6">
        <h2 className="font-display text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" /> Seu link único
        </h2>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={referralLink || 'Gerando código...'}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground truncate"
          />
          <Button size="sm" variant="outline" onClick={copyLink} disabled={!referralCode} aria-label="Copiar link">
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="accent" onClick={shareWhatsApp} disabled={!referralCode} aria-label="Compartilhar no WhatsApp">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        {referralCode && (
          <p className="mt-2 text-xs text-muted-foreground">
            Código: <strong className="font-mono text-accent">{referralCode}</strong> · Quando o indicado completar o onboarding, vocês dois ganham +100 pontos.
          </p>
        )}
      </GlassCard>

      {/* Stats */}
      <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          { label: 'Total', value: referralStats?.total ?? 0, icon: Users },
          { label: 'Concluídas', value: referralStats?.completed ?? 0, icon: CheckCircle2 },
          { label: 'Pendentes', value: referralStats?.pending ?? 0, icon: Clock },
          { label: 'Pontos ganhos', value: referralStats?.points ?? 0, icon: Sparkles },
        ].map((s) => (
          <Card key={s.label} className="p-4 text-center border-border bg-card">
            <s.icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-black text-foreground tabular-nums">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Recent referrals */}
      {referralStats && referralStats.recent.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display text-base font-bold text-foreground mb-3">Indicações recentes</h2>
          <div className="space-y-2">
            {referralStats.recent.map((r: any) => (
              <Card key={r.id} className="p-3 border-border bg-card flex items-center gap-3">
                {r.profiles?.avatar_url ? (
                  <img src={r.profiles.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {(r.profiles?.full_name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.profiles?.full_name || 'Usuário'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.status === 'completed'
                      ? `Concluído · +${r.points_awarded} pts`
                      : 'Aguardando conclusão do onboarding'}
                  </p>
                </div>
                {r.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Clock className="h-4 w-4 text-amber-500" />
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Rewards Section */}
      <div className="mt-6">
        <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
          <Gift className="h-5 w-5 text-accent" /> Clube de Vantagens
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
          <h2 className="font-display text-lg font-bold text-foreground mb-3">Ofertas de Patrocinadores</h2>
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
                      <a href={s.link_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-accent hover:underline">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  {locked && <p className="mt-2 text-[10px] text-muted-foreground">Disponível a partir do nível Engajado</p>}
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
    'Iniciante': 0, 'Entusiasta': 1, 'Engajado': 2, 'Ouro': 3, 'Platina': 4, 'Diamante': 5, 'Mestre': 6,
  };
  return map[levelName] ?? 0;
}

export default DashboardReferralsPage;

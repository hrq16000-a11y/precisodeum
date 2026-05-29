import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Megaphone, Layout, Eye, Users, MessageSquare, PlusCircle } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import RhPublicPageLink from '@/components/dashboard/RhPublicPageLink';
import NextStepPrompt from '@/components/dashboard/NextStepPrompt';
import type { ReactNode } from 'react';

interface RhDashboardSectionProps {
  userId?: string | null;
  jobsCount: number;
  leadsCount: number;
  viewsTotal: number;
  welcomeOpen: boolean;
  onCloseWelcome: () => void;
  providerSlug?: string | null;
  debugBar: ReactNode;
}

/**
 * Visão de Dashboard para Agência de RH / Recrutamento.
 * Extraído de DashboardPage.tsx — HTML/classes idênticos.
 */
const RhDashboardSection = ({
  userId,
  jobsCount,
  leadsCount,
  viewsTotal,
  welcomeOpen,
  onCloseWelcome,
  providerSlug,
  debugBar,
}: RhDashboardSectionProps) => {
  const navigate = useNavigate();

  const items = [
    { icon: Megaphone, title: 'Minhas Vagas', desc: 'Gerencie suas vagas publicadas', path: '/dashboard/vagas', count: jobsCount, countLabel: 'vaga', action: 'Publicar nova vaga' },
    { icon: Layout, title: 'Dados da Agência', desc: 'Edite a página pública da sua agência', path: '/dashboard/agencia' },
    { icon: Eye, title: 'Buscar Profissionais', desc: 'Encontre profissionais para suas vagas', path: '/buscar' },
    { icon: Users, title: 'Comunidade', desc: 'Conecte-se com a comunidade', path: '/dashboard/comunidade' },
  ] as const;

  return (
    <>
      {debugBar}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <motion.div
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-slate-700/10"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
        >
          <Megaphone className="h-5 w-5 text-amber-600" />
        </motion.div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Painel Agência de RH</h1>
          <p className="text-sm text-muted-foreground">Gerencie vagas e candidatos da sua agência de recrutamento</p>
        </div>
      </motion.div>

      <GlassCard variant="gradient" className="mt-6 border-amber-200 dark:border-amber-800/40 bg-gradient-to-br from-amber-500/5 to-slate-500/5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-foreground">Conta Agência de RH / Recrutamento</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Publique vagas com auto-aprovação, acesse perfis qualificados e gerencie processos seletivos.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Métricas focadas em recrutamento (sem portfólio) */}
      <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-200/60 dark:border-amber-800/40 bg-card p-4">
          <div className="flex items-center gap-2 text-amber-600"><Megaphone className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-wide">Minhas Vagas</span></div>
          <p className="mt-1 text-2xl font-bold text-foreground">{jobsCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/60 dark:border-amber-800/40 bg-card p-4">
          <div className="flex items-center gap-2 text-amber-600"><MessageSquare className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-wide">Candidatos</span></div>
          <p className="mt-1 text-2xl font-bold text-foreground">{leadsCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/60 dark:border-amber-800/40 bg-card p-4">
          <div className="flex items-center gap-2 text-amber-600"><Eye className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-wide">Visualizações</span></div>
          <p className="mt-1 text-2xl font-bold text-foreground">{viewsTotal}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <GlassCard key={item.path} variant="default" delay={0.1 + i * 0.1} className="cursor-pointer border-amber-200/40 dark:border-amber-800/30" onClick={() => navigate(item.path)}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                {'count' in item && item.count && item.count > 0 && (
                  <span className="inline-block mt-1 text-xs font-medium text-amber-600">
                    {item.count} {item.countLabel}{item.count !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            {'action' in item && item.action && (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(item.path); }}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:underline"
              >
                <PlusCircle className="h-3.5 w-3.5" /> {item.action}
              </button>
            )}
          </GlassCard>
        ))}
      </div>

      {/* Botão "Ver minha página pública" */}
      <RhPublicPageLink userId={userId} />
      <NextStepPrompt open={welcomeOpen} onClose={onCloseWelcome} context="welcome" providerSlug={providerSlug ?? null} />
    </>
  );
};

export default RhDashboardSection;

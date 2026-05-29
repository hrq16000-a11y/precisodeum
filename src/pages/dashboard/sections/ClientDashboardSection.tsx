import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User, Eye, Megaphone, Sparkles, ArrowRight } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import CoursesBanner from '@/components/dashboard/CoursesBanner';
import NextStepPrompt from '@/components/dashboard/NextStepPrompt';
import type { ReactNode } from 'react';

interface ClientDashboardSectionProps {
  fullName?: string | null;
  welcomeOpen: boolean;
  onCloseWelcome: () => void;
  providerSlug?: string | null;
  debugBar: ReactNode;
}

/**
 * Visão de Dashboard para contas do tipo "client".
 * Extraído de DashboardPage.tsx — HTML/classes idênticos.
 */
const ClientDashboardSection = ({
  fullName,
  welcomeOpen,
  onCloseWelcome,
  providerSlug,
  debugBar,
}: ClientDashboardSectionProps) => {
  const navigate = useNavigate();

  return (
    <>
      {debugBar}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <motion.div
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/10"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
        >
          <User className="h-5 w-5 text-amber-600" />
        </motion.div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Olá, {fullName?.split(' ')[0] || 'Bem-vindo'}!</h1>
          <p className="text-sm text-muted-foreground">Sua conta de cliente</p>
        </div>
      </motion.div>

      <GlassCard variant="gradient" className="mt-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-foreground">Conta Cliente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Como cliente, você pode buscar profissionais, visualizar perfis e entrar em contato por WhatsApp.
            </p>
          </div>
        </div>
      </GlassCard>

      <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2">
        <GlassCard variant="default" delay={0.1} className="cursor-pointer" onClick={() => navigate('/buscar')}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent group-hover:scale-110 transition-transform">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Buscar Profissionais</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Encontre o profissional ideal na sua cidade</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard variant="default" delay={0.2} className="cursor-pointer" onClick={() => navigate('/vagas')}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Ver Vagas</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Confira oportunidades disponíveis</p>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard variant="glow" delay={0.3} className="mt-6">
        <p className="text-sm text-foreground font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          Quer oferecer serviços?
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Altere o tipo da sua conta para "Profissional" na página de perfil e comece a divulgar seus serviços.
        </p>
        <button
          onClick={() => navigate('/dashboard/perfil')}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          Alterar tipo de conta <ArrowRight className="h-3 w-3" />
        </button>
      </GlassCard>

      {/* Courses promotion */}
      <div className="mt-4">
        <CoursesBanner />
      </div>
      <NextStepPrompt open={welcomeOpen} onClose={onCloseWelcome} context="welcome" providerSlug={providerSlug ?? null} />
    </>
  );
};

export default ClientDashboardSection;

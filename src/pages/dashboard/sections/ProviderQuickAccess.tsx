import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Settings, Eye, PlusCircle, Building2, Sparkles } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import CelebrationMuteToggle from '@/components/dashboard/CelebrationMuteToggle';
import LeadAnalytics from '@/components/dashboard/LeadAnalytics';
import AchievementHistory from '@/components/dashboard/AchievementHistory';

interface ProviderQuickAccessProps {
  servicesCount: number | null;
  providerSlug?: string | null;
  providerId?: string | null;
  isCompanyProvider: boolean;
  showFullAddress: boolean;
  levelName?: string | null;
}

/**
 * "Acesso Rápido" — grid de cards de navegação + atalhos.
 * Extraído de DashboardPage.tsx — HTML/classes idênticos.
 */
const ProviderQuickAccess = ({
  servicesCount,
  providerSlug,
  providerId,
  isCompanyProvider,
  showFullAddress,
  levelName,
}: ProviderQuickAccessProps) => {
  const navigate = useNavigate();

  return (
    <div className="mt-6">
      <motion.h2
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4 }}
        className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"
      >
        <Sparkles className="h-3.5 w-3.5 text-accent" />
        Acesso Rápido
      </motion.h2>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <GlassCard variant="default" delay={0.5} className="cursor-pointer" onClick={() => navigate('/dashboard/servicos')} data-tour="services">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent transition-all duration-300 group-hover:bg-accent group-hover:text-accent-foreground">
              <Settings className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-foreground">Meus Serviços</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Gerencie seus serviços cadastrados</p>
              {servicesCount !== null && servicesCount > 0 && (
                <span className="inline-block mt-1.5 text-xs font-medium text-accent">{servicesCount} ativo{servicesCount !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); navigate('/dashboard/servicos'); }}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
            <PlusCircle className="h-3.5 w-3.5" /> Adicionar novo serviço
          </button>
        </GlassCard>

        {providerSlug && (
          <GlassCard variant="bordered" delay={0.7} className="cursor-pointer border-dashed" onClick={() => navigate(`/profissional/${providerSlug}`)}>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Eye className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground">Ver Minha Página</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Veja como seu perfil aparece para os clientes</p>
              </div>
            </div>
          </GlassCard>
        )}

        {isCompanyProvider && (
          <GlassCard
            variant="default"
            delay={0.65}
            className="cursor-pointer"
            onClick={() => navigate('/dashboard/empresa')}
            data-tour="company-data"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground">
                  Minha Empresa <span className="text-[10px] font-medium text-muted-foreground">(Opcional)</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Endereço, segmento e privacidade do seu ponto físico.
                </p>
                {showFullAddress ? (
                  <span className="inline-block mt-1.5 text-[11px] font-medium text-emerald-600">
                    Endereço público ativo
                  </span>
                ) : (
                  <span className="inline-block mt-1.5 text-[11px] font-medium text-muted-foreground">
                    Endereço completo oculto
                  </span>
                )}
              </div>
            </div>
          </GlassCard>
        )}

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 shadow-sm">
          <div className="min-w-0">
            <span className="text-sm font-semibold text-foreground">Som de conquistas</span>
            <p className="text-xs text-muted-foreground">Controla o áudio das celebrações; confetes continuam ativos.</p>
          </div>
          <CelebrationMuteToggle />
        </div>

        <LeadAnalytics providerId={providerId ?? null} />

        <AchievementHistory providerSlug={providerSlug ?? null} levelName={levelName ?? null} />
      </div>
    </div>
  );
};

export default ProviderQuickAccess;

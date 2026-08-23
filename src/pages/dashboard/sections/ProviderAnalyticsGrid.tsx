import { FileText } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import LeadsChart from '@/components/dashboard/LeadsChart';
import ConversionInsights from '@/components/dashboard/ConversionInsights';
import LeadInsights from '@/components/dashboard/LeadInsights';
import RecentActivity from '@/components/dashboard/RecentActivity';
import ContactConversionReport from '@/components/dashboard/ContactConversionReport';

interface ProviderAnalyticsGridProps {
  providerId: string;
  viewsTotal: number;
  leadsCount: number;
  servicesCount: number;
}

/**
 * Analytics Grid — só é montado quando há dados reais (views ou leads > 0).
 * O gate de visibilidade fica no Dashboard; aqui presumimos contagens válidas.
 */
const ProviderAnalyticsGrid = ({
  providerId,
  viewsTotal,
  leadsCount,
  servicesCount,
}: ProviderAnalyticsGridProps) => (
  <div className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-2">
    <GlassCard variant="default" hoverEffect={false} delay={0.4} data-tour="leads">
      <LeadsChart providerId={providerId} />
    </GlassCard>

    <GlassCard variant="default" hoverEffect={false} delay={0.5}>
      <ConversionInsights views={viewsTotal} leads={leadsCount} services={servicesCount} />
    </GlassCard>

    <div className="lg:col-span-2">
      <LeadInsights providerId={providerId} />
    </div>

    {leadsCount > 0 && (
      <GlassCard variant="bordered" hoverEffect={false} delay={0.6}>
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" />
          Atividade Recente
        </h3>
        <RecentActivity providerId={providerId} />
      </GlassCard>
    )}
  </div>
);

export default ProviderAnalyticsGrid;

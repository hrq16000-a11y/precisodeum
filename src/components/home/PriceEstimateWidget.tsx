import { DollarSign } from 'lucide-react';
import { getPriceEstimate } from '@/lib/priceEstimates';

interface Props {
  categorySlug: string;
  categoryName: string;
  city?: string;
}

const PriceEstimateWidget = ({ categorySlug, categoryName, city }: Props) => {
  const estimate = getPriceEstimate(categorySlug);
  if (!estimate) return null;

  const location = city || 'sua região';

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4 animate-fade-in">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15">
        <DollarSign className="h-5 w-5 text-accent" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">
          Faixa de preço estimada para {categoryName} em {location}
        </p>
        <p className="mt-0.5 text-lg font-bold text-accent">
          R$ {estimate.min.toLocaleString('pt-BR')} – R$ {estimate.max.toLocaleString('pt-BR')}
          <span className="ml-1 text-xs font-normal text-muted-foreground">/ {estimate.unit}</span>
        </p>
      </div>
    </div>
  );
};

export default PriceEstimateWidget;

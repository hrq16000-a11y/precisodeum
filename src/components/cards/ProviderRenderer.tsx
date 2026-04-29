import { memo } from 'react';
import type { DbProvider } from '@/hooks/useProviders';
import ProviderCard from '@/components/ProviderCard';
import CompanyCard from '@/components/cards/CompanyCard';

/**
 * ProviderRenderer — wrapper polimórfico que decide entre o card empresarial
 * (PJ) e o card do profissional autônomo (PF) sem alterar o comportamento
 * legado de cada componente.
 *
 * Regra: account_type === 'company' → CompanyCard, caso contrário ProviderCard.
 *
 * Mantém a mesma assinatura (provider + isFallback + trackingSource + index)
 * para que SearchPage/FeaturedProviders/CategoryPage possam trocar
 * `<ProviderCard ... />` por `<ProviderRenderer ... />` sem regressão.
 */
interface Props {
  provider: DbProvider;
  isFallback?: boolean;
  trackingSource?: string;
  index?: number;
}

const ProviderRenderer = memo(function ProviderRenderer({
  provider,
  isFallback,
  trackingSource,
  index,
}: Props) {
  const isCompany = (provider.accountType || '').toString().toLowerCase() === 'company';
  if (isCompany) {
    return <CompanyCard provider={provider} trackingSource={trackingSource} />;
  }
  return (
    <ProviderCard
      provider={provider}
      isFallback={isFallback}
      trackingSource={trackingSource}
      index={index}
    />
  );
});

export default ProviderRenderer;

import { useEffect } from 'react';
import { useLocation } from '@/lib/router-compat';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import {
  applyAnalyticsConfig,
  parseAnalyticsConfig,
  trackAnalyticsPageView,
} from '@/lib/analyticsLoader';

/**
 * AnalyticsLoader — injeta GA4/GTM a partir das configurações do painel admin
 * e envia page_view a cada troca de rota (SPA). Sem IDs configurados, é no-op.
 */
const AnalyticsLoader = () => {
  const { data } = useSiteSettings();
  const location = useLocation();
  const config = parseAnalyticsConfig(data?.values);

  useEffect(() => {
    applyAnalyticsConfig(config);
  }, [config.enabled, config.ga4Id, config.gtmId]);

  useEffect(() => {
    if (!config.enabled || (!config.ga4Id && !config.gtmId)) return;
    trackAnalyticsPageView(location.pathname + location.search);
  }, [location.pathname, location.search, config.enabled, config.ga4Id, config.gtmId]);

  return null;
};

export default AnalyticsLoader;

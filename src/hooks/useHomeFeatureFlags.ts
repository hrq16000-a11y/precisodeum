import { useMemo } from 'react';
import { useSiteSettings } from '@/hooks/useSiteSettings';

/** Single hook that returns all homepage feature flags + settings at once,
 *  avoiding 10+ individual subscriptions to the same queryKey. */
export function useHomeFeatureFlags() {
  const { data } = useSiteSettings();
  const flags = data?.flags;
  const values = data?.values;

  return useMemo(() => ({
    // Feature flags
    reviewsEnabled: flags?.reviews_enabled ?? false,
    featuredEnabled: flags?.featured_providers_enabled ?? false,
    popularSearchesEnabled: flags?.popular_searches_enabled ?? false,
    faqEnabled: flags?.faq_enabled ?? false,
    blogEnabled: flags?.module_blog ?? false,
    jobsEnabled: flags?.module_jobs ?? false,
    howItWorksEnabled: flags?.module_howitworks ?? false,
    ctaEnabled: flags?.module_cta ?? false,
    citiesEnabled: flags?.module_cities ?? false,
    sponsorsEnabled: flags?.module_sponsors ?? false,
    heroBannersEnabled: flags?.module_hero_banners ?? false,
    // Settings values
    sectionsOrderRaw: values?.homepage_sections_order ?? '',
    hiddenSectionsRaw: values?.homepage_hidden_sections ?? '',
  }), [flags, values]);
}

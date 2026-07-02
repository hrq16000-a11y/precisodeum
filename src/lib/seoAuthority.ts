export type SeoAuthorityProvider = {
  levelName?: string | null;
  levelPriority?: number | null;
  rating?: number | string | null;
  rating_avg?: number | string | null;
  reviewCount?: number | string | null;
  review_count?: number | string | null;
};

const ELITE_LEVEL_PRIORITY = 4;

function getProviderRating(provider: SeoAuthorityProvider) {
  return Number(provider.rating ?? provider.rating_avg ?? 0) || 0;
}

function getProviderReviewCount(provider: SeoAuthorityProvider) {
  return Number(provider.reviewCount ?? provider.review_count ?? 0) || 0;
}

function isEliteAuthority(provider: SeoAuthorityProvider) {
  const level = (provider.levelName || '').toLowerCase();
  const priority = Number(provider.levelPriority || 0);
  return priority >= ELITE_LEVEL_PRIORITY || level.includes('diamante') || level.includes('ouro');
}

export function getSeoAuthorityData<T extends SeoAuthorityProvider>(providers: T[]) {
  const eligibleProviders = providers.filter((provider) => getProviderRating(provider) > 0);
  const eliteProviders = eligibleProviders.filter(isEliteAuthority);
  const authorityProviders = eliteProviders.length > 0 ? eliteProviders : eligibleProviders;
  const reviewCount = authorityProviders.reduce((total, provider) => total + getProviderReviewCount(provider), 0);
  const ratingSum = authorityProviders.reduce((total, provider) => total + getProviderRating(provider), 0);

  if (authorityProviders.length === 0) {
    return {
      authorityProviders,
      hasEliteAuthority: false,
      aggregateRating: null,
    };
  }

  return {
    authorityProviders,
    hasEliteAuthority: eliteProviders.length > 0,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: (ratingSum / authorityProviders.length).toFixed(1),
      reviewCount: reviewCount || authorityProviders.length,
      bestRating: 5,
      worstRating: 1,
    },
  };
}

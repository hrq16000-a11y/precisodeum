// Lightweight fallback used by lazy-loaded dashboard sections.
// Reserves vertical space to avoid CLS while the chunk hydrates.
export const SectionSkeleton = ({ minH = 'min-h-32' }: { minH?: string }) => (
  <div
    aria-hidden="true"
    className={`mt-4 ${minH} animate-pulse rounded-2xl bg-card/40 border border-border/40`}
  />
);

export default SectionSkeleton;

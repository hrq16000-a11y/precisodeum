import { Skeleton } from '@/components/ui/skeleton';

const PinnedSponsorSkeleton = () => (
  <div className="mb-4 sm:mb-5 overflow-hidden rounded-2xl border border-accent/20 bg-card">
    <div className="flex flex-col sm:flex-row">
      <Skeleton className="h-40 w-full shrink-0 sm:h-auto sm:w-48 md:w-56" />
      <div className="flex flex-1 flex-col justify-center gap-2 p-4 sm:p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="mt-2 h-9 w-40 rounded-md" />
      </div>
    </div>
  </div>
);

export default PinnedSponsorSkeleton;

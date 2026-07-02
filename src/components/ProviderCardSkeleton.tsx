import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  count?: number;
}

const ProviderCardSkeleton = ({ count = 6 }: Props) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card"
      >
        <div className="flex flex-1 flex-col p-3 sm:p-5">
          <div className="flex gap-3 sm:gap-4">
            {/* Avatar */}
            <Skeleton className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              {/* Name */}
              <Skeleton className="h-4 w-3/4" />
              {/* Category */}
              <Skeleton className="h-3 w-1/2" />
              {/* Location */}
              <Skeleton className="h-3 w-2/3" />
              {/* Badges */}
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>
          </div>
          {/* Rating */}
          <div className="mt-3">
            <Skeleton className="h-3.5 w-28" />
          </div>
          {/* Description */}
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-1 h-3 w-4/5" />
          {/* Buttons */}
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
          <Skeleton className="mx-auto mt-1.5 h-2.5 w-32" />
        </div>
      </div>
    ))}
  </>
);

export default ProviderCardSkeleton;

import { motion } from 'framer-motion';

const CoursesSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
    {Array.from({ length: 6 }).map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: i * 0.08 }}
        className="rounded-xl border border-border/40 bg-card p-5 space-y-3"
      >
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted animate-pulse rounded-md w-4/5" />
            <div className="h-3 bg-muted animate-pulse rounded-md w-2/5" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-3 bg-muted animate-pulse rounded-md w-full" />
          <div className="h-3 bg-muted animate-pulse rounded-md w-3/4" />
        </div>
        <div className="flex gap-2">
          <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
          <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
          <div className="h-5 w-18 bg-muted animate-pulse rounded-full" />
        </div>
      </motion.div>
    ))}
  </div>
);

export default CoursesSkeleton;

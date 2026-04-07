import { motion } from 'framer-motion';

const CinematicLoader = () => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-6">
      {/* Logo pulse */}
      <motion.div
        className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/30 to-accent/0"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className="relative text-2xl font-bold text-primary-foreground">P</span>
      </motion.div>

      {/* Shimmer bar */}
      <div className="relative h-1 w-48 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-accent to-transparent"
          animate={{ x: ['-100%', '400%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Skeleton preview */}
      <div className="w-full max-w-sm space-y-3 px-4">
        <motion.div
          className="h-6 w-3/4 rounded-lg bg-muted"
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <motion.div
          className="h-4 w-full rounded bg-muted"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
        />
        <motion.div
          className="h-4 w-5/6 rounded bg-muted"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
        />
      </div>
    </div>
  </div>
);

export default CinematicLoader;

import { forwardRef } from 'react';

/** Lightweight loading skeleton — no framer-motion to keep the initial bundle small */
const CinematicLoader = forwardRef<HTMLDivElement>((_, ref) => (
  <div className="flex min-h-[60vh] items-center justify-center bg-background" ref={ref}>
    <div className="flex flex-col items-center gap-6">
      <img src="/favicon.ico" alt="" className="h-12 w-12 animate-pulse" />
      <div className="relative h-1 w-48 overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-accent to-transparent animate-shimmer" />
      </div>
      <div className="w-full max-w-sm space-y-3 px-4">
        <div className="h-6 w-3/4 rounded-lg bg-muted animate-pulse" />
        <div className="h-4 w-full rounded bg-muted animate-pulse [animation-delay:200ms]" />
        <div className="h-4 w-5/6 rounded bg-muted animate-pulse [animation-delay:400ms]" />
      </div>
    </div>
  </div>
));

CinematicLoader.displayName = 'CinematicLoader';
export default CinematicLoader;

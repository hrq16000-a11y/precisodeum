import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { motion } from 'framer-motion';

export interface BreadcrumbItem {
  label: string;
  url?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  variant?: 'default' | 'hero';
}

const Breadcrumbs = ({ items, className = '', variant = 'default' }: BreadcrumbsProps) => {
  const allItems: BreadcrumbItem[] = [{ label: 'Home', url: '/' }, ...items];
  const isHero = variant === 'hero';

  const wrapperClasses = isHero
    ? `inline-flex items-center gap-1.5 text-sm bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/15 ${className}`
    : `flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto scrollbar-hide ${className}`;

  return (
    <nav aria-label="Breadcrumb" className={wrapperClasses}>
      {allItems.map((item, i) => {
        const isLast = i === allItems.length - 1;
        return (
          <motion.span
            key={i}
            className="flex items-center gap-1 whitespace-nowrap"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
          >
            {i > 0 && (
              <ChevronRight className={`h-3 w-3 flex-shrink-0 ${isHero ? 'text-white/40' : 'text-muted-foreground/40'}`} />
            )}
            {i === 0 && (
              <Home className={`h-3 w-3 mr-0.5 ${isHero ? 'text-white/60' : ''}`} />
            )}
            {isLast || !item.url ? (
              <span className={
                isHero
                  ? `font-semibold ${isLast ? 'text-white' : 'text-white/70'}`
                  : `font-medium ${isLast ? 'text-foreground' : ''}`
              }>
                {item.label}
              </span>
            ) : (
              <Link
                to={item.url}
                className={
                  isHero
                    ? 'text-white/70 transition-colors hover:text-white'
                    : 'transition-colors hover:text-foreground'
                }
              >
                {item.label}
              </Link>
            )}
          </motion.span>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;

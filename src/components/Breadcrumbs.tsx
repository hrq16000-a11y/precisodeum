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
}

const Breadcrumbs = ({ items, className = '' }: BreadcrumbsProps) => {
  const allItems: BreadcrumbItem[] = [{ label: 'Home', url: '/' }, ...items];

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto scrollbar-hide ${className}`}>
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
            {i > 0 && <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground/40" />}
            {i === 0 && <Home className="h-3 w-3 mr-0.5" />}
            {isLast || !item.url ? (
              <span className={`font-medium ${isLast ? 'text-foreground' : ''}`}>{item.label}</span>
            ) : (
              <Link
                to={item.url}
                className="transition-colors hover:text-foreground"
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

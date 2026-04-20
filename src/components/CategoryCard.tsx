import { Link } from 'react-router-dom';
import { usePrefetchCategory, usePrefetchHandlers } from '@/hooks/usePrefetch';
import { motion } from 'framer-motion';
import CategoryIcon from '@/components/CategoryIcon';

interface CategoryCardProps {
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string;
    count: number;
    image_url?: string | null;
  };
  index?: number;
}

const CategoryCard = ({ category, index = 0 }: CategoryCardProps) => {
  const prefetch = usePrefetchCategory();
  const handlers = usePrefetchHandlers(prefetch, category.slug);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -6, scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
    >
      <Link
        to={`/categoria/${category.slug}`}
        className="group relative flex flex-col items-center gap-[0.75rem] rounded-3xl border border-border/50 bg-card p-[1.25rem] shadow-[0_2px_12px_-2px_rgb(0_0_0/0.08)] transition-all duration-300 hover:shadow-[0_8px_24px_-4px_rgb(0_0_0/0.12)] hover:border-accent/30"
        {...handlers}
      >
        <motion.span
          className="flex min-h-[3rem] min-w-[3rem] h-12 w-12 items-center justify-center rounded-2xl bg-accent/10"
          whileHover={{ scale: 1.2, rotate: [0, -10, 10, 0] }}
          transition={{ duration: 0.4 }}
        >
          <CategoryIcon icon={category.icon} size={28} />
        </motion.span>
        <span className="text-center text-sm font-semibold text-foreground group-hover:text-accent transition-colors" style={{ hyphens: 'auto' }}>
          {category.name}
        </span>
      </Link>
    </motion.div>
  );
};

export default CategoryCard;

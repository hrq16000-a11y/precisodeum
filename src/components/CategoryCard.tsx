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
        className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-accent/30"
        {...handlers}
      >
        <motion.span
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50"
          whileHover={{ scale: 1.2, rotate: [0, -10, 10, 0] }}
          transition={{ duration: 0.4 }}
        >
          <CategoryIcon icon={category.icon} size={28} />
        </motion.span>
        <span className="text-center text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
          {category.name}
        </span>
        <span className="text-xs text-muted-foreground">{category.count.toLocaleString('pt-BR')} profissionais</span>
      </Link>
    </motion.div>
  );
};

export default CategoryCard;

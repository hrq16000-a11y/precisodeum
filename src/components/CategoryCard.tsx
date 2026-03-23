import { Link } from 'react-router-dom';
import { usePrefetchCategory, usePrefetchHandlers } from '@/hooks/usePrefetch';

interface CategoryCardProps {
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string;
    count: number;
  };
}

const CategoryCard = ({ category }: CategoryCardProps) => {
  const prefetch = usePrefetchCategory();
  const handlers = usePrefetchHandlers(prefetch, category.slug);

  return (
    <Link
      to={`/categoria/${category.slug}`}
      className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 hover:border-accent/30"
      {...handlers}
    >
      <span className="text-3xl">{category.icon}</span>
      <span className="text-center text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
        {category.name}
      </span>
      <span className="text-xs text-muted-foreground">{category.count.toLocaleString('pt-BR')} profissionais</span>
    </Link>
  );
};

export default CategoryCard;

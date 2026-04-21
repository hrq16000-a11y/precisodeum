import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useFavorites } from '@/hooks/useFavorites';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  providerId: string;
  providerName?: string;
  className?: string;
}

const FavoriteButton = ({ providerId, providerName, className }: Props) => {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(providerId);

  const handle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nowFav = await toggle(providerId);
    toast.success(
      nowFav
        ? `${providerName || 'Profissional'} salvo nos favoritos`
        : 'Removido dos favoritos'
    );
  };

  return (
    <motion.button
      type="button"
      onClick={handle}
      whileTap={{ scale: 0.85 }}
      whileHover={{ scale: 1.1 }}
      aria-label={fav ? 'Remover dos favoritos' : 'Salvar como favorito'}
      aria-pressed={fav}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 backdrop-blur shadow-sm border border-border/60 transition-colors hover:bg-background',
        className
      )}
    >
      <Heart
        className={cn(
          'h-4 w-4 transition-colors',
          fav ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground'
        )}
      />
    </motion.button>
  );
};

export default FavoriteButton;

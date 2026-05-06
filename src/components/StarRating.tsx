import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  size?: number;
  showValue?: boolean;
  count?: number;
}

const StarRating = ({ rating, size = 16, showValue = true, count }: StarRatingProps) => {
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${star <= Math.round(rating) ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`}
            style={{ width: size, height: size }}
          />
        ))}
      </div>
      {showValue && (
        <span className="ml-1 text-sm font-semibold text-foreground">{rating.toFixed(1)}</span>
      )}
      {count !== undefined && (
        <span className="text-sm text-muted-foreground">({count})</span>
      )}
    </div>
  );
};

export default StarRating;

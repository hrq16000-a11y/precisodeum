import { Star, Quote } from 'lucide-react';
import { motion } from 'framer-motion';

interface Review {
  id: string;
  rating: number;
  comment: string;
  profiles?: { full_name?: string };
  created_at?: string;
}

interface TestimonialsCarouselProps {
  reviews: Review[];
}

const TestimonialsCarousel = ({ reviews }: TestimonialsCarouselProps) => {
  const withComments = reviews.filter(r => r.comment?.trim()).slice(0, 3);
  if (withComments.length === 0) return null;

  return (
    <motion.div
      className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
          <Quote className="h-4 w-4 text-accent" />
        </div>
        <h2 className="font-display text-lg font-bold text-foreground">O que dizem nossos clientes</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {withComments.map((r, i) => (
          <motion.div
            key={r.id}
            className="rounded-lg border border-border/60 bg-muted/30 p-4 relative"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          >
            <Quote className="absolute top-3 right-3 h-5 w-5 text-accent/10" />
            <div className="flex items-center gap-0.5 mb-2">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className={`h-3 w-3 ${s <= Math.round(r.rating) ? 'fill-accent text-accent' : 'text-muted-foreground/20'}`} />
              ))}
            </div>
            <p className="text-sm text-foreground/80 line-clamp-4 italic">"{r.comment}"</p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              — {r.profiles?.full_name || 'Cliente'}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default TestimonialsCarousel;

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Images } from 'lucide-react';

interface DiscoverPreview {
  id: string;
  variant_name: string;
  title_variant: string;
  description_variant: string;
  image_variant_url: string;
}

const DiscoverPreviewSection = ({ previews }: { previews: DiscoverPreview[] }) => {
  if (!previews.length) return null;

  return (
    <section className="mt-10 border-t border-border pt-8" aria-labelledby="discover-preview-title">
      <div className="mb-4 flex items-center gap-2">
        <Eye className="h-4 w-4 text-accent" />
        <h2 id="discover-preview-title" className="font-display text-xl font-bold text-foreground">
          Preview Google Discover
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {previews.map((preview) => (
          <Card key={preview.id} className="overflow-hidden border-border/70">
            <img src={preview.image_variant_url} alt={preview.title_variant} className="aspect-video w-full object-cover" loading="lazy" />
            <CardContent className="p-4">
              <Badge variant="secondary" className="mb-2 gap-1 text-[11px]">
                <Images className="h-3 w-3" /> {preview.variant_name}
              </Badge>
              <h3 className="line-clamp-2 text-base font-bold leading-tight text-foreground">{preview.title_variant}</h3>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{preview.description_variant}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default DiscoverPreviewSection;